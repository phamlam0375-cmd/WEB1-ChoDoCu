'use strict';

const { HttpError } = require('../../utils/httpError');
const { validateOrderId, validateCancelReason } = require('../../validators/D02_HuyDonHang/cancellation.validator');
const defaultRepository = require('../../repositories/D02_HuyDonHang/cancellation.repository');

const CANNOT_CANCEL = 'Không thể hủy đơn ở trạng thái hiện tại.';
const REFUND_REQUIRED = 'Vui lòng tạo yêu cầu hoàn tiền trước khi đóng đơn.';
const PAID = ['PAID', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED'];
const DIRECT = ['RESERVED', 'WAITING_PAYMENT'];

function cancellationPolicy({ order, payment, deliveries, refund }) {
  if (order.Status === 'CANCELLED') return { action: 'CANCELLED' };
  if (order.Status === 'REFUND_PENDING' || order.Status === 'REFUNDED' || refund) {
    return { action: 'BLOCKED', message: CANNOT_CANCEL };
  }
  if (PAID.includes(order.Status) || payment?.Status === 'CONFIRMED') {
    return { action: 'REFUND', message: REFUND_REQUIRED, refundUrl: `/orders/${order.OrderId}/refund` };
  }
  if (payment?.Status === 'REPORTED') {
    return { action: 'VERIFY_PAYMENT', message: CANNOT_CANCEL, detail: 'Đã báo chuyển tiền; cần người bán xác minh giao dịch trước khi xử lý hủy hoặc hoàn tiền.' };
  }
  if (!DIRECT.includes(order.Status) || (payment && !['WAITING', 'REJECTED'].includes(payment.Status)) || deliveries.length) {
    return { action: 'BLOCKED', message: CANNOT_CANCEL };
  }
  return { action: 'CANCEL' };
}

function createCancellationService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  async function ownedState(id, user, transaction) {
    const userId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    const state = await repository.readState(id, transaction);
    if (!state) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    // D02 phía người mua; C06 của người bán và B07 của quản trị giữ nguyên quyền riêng.
    if (Number(state.order.BuyerId) !== userId) throw new HttpError(403, 'Bạn không có quyền hủy đơn này.', null, 'ORDER_FORBIDDEN');
    return state;
  }

  function preview(state) {
    const { order, listing, payment } = state;
    return {
      orderId: Number(order.OrderId), listingId: Number(order.ListingId), title: listing?.Title || null,
      productAmount: order.ProductAmount, deliveryFee: order.DeliveryFee, totalAmount: order.TotalAmount,
      status: order.Status, paymentStatus: payment?.Status || null, deliveryMethod: order.DeliveryMethod,
      cancelReason: order.CancelReason, reservedUntil: order.ReservedUntil,
      listingStatus: listing?.Status || null, ...cancellationPolicy(state),
    };
  }

  async function run(work) {
    try { return await repository.withTransaction(work); }
    catch (error) {
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code || error.parent?.code)) {
        throw new HttpError(409, 'Đơn hàng đang được xử lý. Vui lòng tải lại và thử lại.', null, 'ORDER_CONFLICT');
      }
      throw error;
    }
  }

  async function getCancellationPreview(orderId, user) {
    const id = validateOrderId(orderId);
    return run(async transaction => preview(await ownedState(id, user, transaction)));
  }

  async function cancelOrder(orderId, body, user) {
    const id = validateOrderId(orderId);
    const reason = validateCancelReason(body);
    return run(async transaction => {
      const state = await ownedState(id, user, transaction);
      const policy = cancellationPolicy(state);
      const message = `Đơn #${id} đã được hủy.`;
      if (policy.action === 'CANCELLED') return { message, data: { ...preview(state), alreadyCancelled: true } };
      if (policy.action !== 'CANCEL') {
        throw new HttpError(409, policy.message, { ...policy }, policy.action === 'REFUND' ? 'REFUND_REQUIRED' : policy.action === 'VERIFY_PAYMENT' ? 'PAYMENT_VERIFICATION_REQUIRED' : 'ORDER_NOT_CANCELLABLE');
      }
      if (await repository.markCancelled(state.order, reason, transaction) !== 1) {
        throw new HttpError(409, CANNOT_CANCEL, null, 'ORDER_CONFLICT');
      }
      const listingReopened = await repository.reopenListing(state.order.ListingId, transaction) === 1;
      const now = clock();
      await repository.createHistory({ OrderId: id, DeliveryId: null, StatusType: 'ORDER', StatusValue: 'CANCELLED', Note: reason, ChangedBy: Number(state.order.BuyerId), CreatedAt: now }, transaction);
      for (const userId of new Set([state.order.BuyerId, state.order.SellerId])) {
        await repository.notifyUser(userId, { type: 'ORDER', title: 'Đơn hàng đã được hủy', message, referenceType: 'ORDER', referenceId: id, createdAt: now }, transaction);
      }
      state.order = { ...state.order, Status: 'CANCELLED', CancelReason: reason };
      if (listingReopened) state.listing = { ...state.listing, Status: 'ACTIVE' };
      return { message, data: { ...preview(state), alreadyCancelled: false, listingReopened } };
    });
  }
  return { getCancellationPreview, cancelOrder };
}

module.exports = { ...createCancellationService(), createCancellationService, cancellationPolicy };
