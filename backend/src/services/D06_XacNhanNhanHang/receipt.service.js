'use strict';
const { HttpError } = require('../../utils/httpError');
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const { refundEligibility } = require('../../controllers/refunds.controller');
const v = require('../../validators/D06_XacNhanNhanHang/receipt.validator');
const defaultRepository = require('../../repositories/D06_XacNhanNhanHang/receipt.repository');

const SUCCESS = 'Đã xác nhận nhận hàng; đơn đã hoàn tất.';
const date = value => value ? new Date(value).getTime() : NaN;
const proof = value => typeof value === 'string' && /^(?:\/(?!\/)|https?:\/\/)[^\s]+$/i.test(value);
function receiptPolicy({ order: o, payment: p, deliveries = [], refunds = [], refund }, now = new Date()) {
  const blocked = (code, reason) => ({ canConfirm: false, code, reason });
  if (o.Status === 'COMPLETED') return blocked('ALREADY_COMPLETED', 'Đơn hàng đã hoàn tất; không cần xác nhận lại.');
  if (refunds.some(row => row.Status !== 'REJECTED') || (refund && refund.Status !== 'REJECTED')) return blocked('REFUND_ACTIVE', 'Đơn đang có quy trình hoàn tiền; không thể xác nhận hoàn tất.');
  if (o.DeliveryMethod === 'PICKUP') return blocked('PICKUP_HANDOVER_UNAVAILABLE', 'Người bán chưa ghi nhận bàn giao sản phẩm. Quy trình xác minh bàn giao tự đến lấy chưa sẵn sàng.');
  if (o.Status !== 'DELIVERED' || o.DeliveryMethod !== 'DELIVERY') return blocked('ORDER_NOT_DELIVERED', 'Chưa thể xác nhận nhận hàng ở trạng thái hiện tại.');
  if (o.CompletedAt) return blocked('ORDER_DATA_MISMATCH', 'Thời điểm hoàn tất không khớp trạng thái đơn; cần kiểm tra dữ liệu.');
  if (!p || p.Status !== 'CONFIRMED' || Number(p.OrderId) !== Number(o.OrderId) || Number(p.PayerId) !== Number(o.BuyerId)
      || Number(p.PayeeId) !== Number(o.SellerId) || Number(p.ConfirmedBy) !== Number(o.SellerId)
      || !matchesAmount(p.Amount, o.ProductAmount) || !Number.isFinite(date(p.ConfirmedAt)) || date(p.ConfirmedAt) > now.getTime()
      || !Number.isFinite(date(p.ReportedAt)) || !proof(p.ProofUrl) || !snapshotBank(p) || !p.TransferContent?.trim()) {
    return blocked('PAYMENT_NOT_CONFIRMED', 'Thanh toán tiền sản phẩm chưa được người bán xác nhận hợp lệ.');
  }
  const d = deliveries.length === 1 ? deliveries[0] : null;
  if (!d || Number(d.OrderId) !== Number(o.OrderId) || !Number.isSafeInteger(Number(d.DriverId)) || Number(d.DriverId) < 1
      || d.Status !== 'DELIVERED' || d.ReturnedAt || !proof(d.ProofUrl)
      || !Number.isFinite(date(d.VerifiedAt)) || date(d.VerifiedAt) > now.getTime()
      || !Number.isFinite(date(d.DeliveredAt)) || date(d.DeliveredAt) > now.getTime()) {
    return blocked('DELIVERY_NOT_VERIFIED', 'Chuyến giao chưa có đủ xác thực giao thành công và ảnh bàn giao.');
  }
  return { canConfirm: true, code: 'READY', reason: null };
}
function receiptView(state, now, alreadyCompleted = false) {
  const { order: o, payment: p, listing } = state;
  const r = refundEligibility({ ...state, windowDays: state.refundWindowDays, now });
  return { orderId: Number(o.OrderId), product: { listingId: Number(o.ListingId), title: listing?.Title || null },
    orderStatus: o.Status, deliveryMethod: o.DeliveryMethod, productAmount: o.ProductAmount, deliveryFee: o.DeliveryFee, totalAmount: o.TotalAmount,
    paymentStatus: p?.Status || null, completedAt: o.CompletedAt, alreadyCompleted,
    deliveries: o.DeliveryMethod === 'DELIVERY' ? state.deliveries.map(d => ({ deliveryId: d.DeliveryId, status: d.Status, deliveredAt: d.DeliveredAt, verifiedAt: d.VerifiedAt })) : [],
    policy: receiptPolicy(state, now), capabilities: {
      refund: { enabled: r.enabled, href: r.enabled ? `/orders/${o.OrderId}/refund` : null, reason: r.reason || null },
      review: { enabled: false, href: null, reason: 'Chức năng đánh giá sau giao dịch chưa sẵn sàng.' },
    }, serverNow: now.toISOString() };
}
function createReceiptService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  async function ownedOrder(id, user, transaction, lock) {
    const buyerId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(buyerId) || buyerId < 1 || user?.d01Demo) throw new HttpError(401, 'Vui lòng đăng nhập để xác nhận nhận hàng.', null, 'UNAUTHORIZED');
    const order = await repository.readOrder(id, transaction, lock);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    if (Number(order.BuyerId) !== buyerId) throw new HttpError(403, 'Chỉ người mua của đơn được xác nhận nhận hàng.', null, 'ORDER_FORBIDDEN');
    return order;
  }
  async function run(work, readOnly = false) {
    try { return await (readOnly ? repository.withSnapshot : repository.withTransaction)(work); }
    catch (error) {
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code || error.parent?.code)) throw new HttpError(409, 'Đơn đang được xử lý. Vui lòng tải lại trước khi xác nhận.', null, 'ORDER_CONFLICT');
      throw error;
    }
  }
  async function getPreview(orderId, user) {
    const id = v.validateOrderId(orderId);
    return run(async transaction => {
      const order = await ownedOrder(id, user, transaction, false);
      return receiptView(await repository.readRelated(order, transaction, false), clock());
    }, true);
  }
  async function confirmReceived(orderId, body, user) {
    const id = v.validateOrderId(orderId); v.validateConfirmation(body);
    return run(async transaction => {
      const order = await ownedOrder(id, user, transaction, true);
      const state = await repository.readRelated(order, transaction, true), now = clock();
      if (order.Status === 'COMPLETED') return { message: SUCCESS, data: receiptView(state, now, true) };
      const policy = receiptPolicy(state, now);
      if (!policy.canConfirm) throw new HttpError(409, policy.reason, null, policy.code);
      if (await repository.markCompleted(order, now, transaction) !== 1) throw new HttpError(409, 'Đơn đã thay đổi. Vui lòng tải lại.', null, 'ORDER_CONFLICT');
      // Giữ nguyên cơ chế B08 (kể cả fallback tỷ lệ 0 đã được nhóm xác nhận).
      await repository.createCommission(id, transaction);
      await repository.markListingSold(order, transaction); // Chỉ RESERVED -> SOLD, không mở bán hoặc ghi đè trạng thái kiểm duyệt.
      await repository.createHistory({ OrderId: id, DeliveryId: null, StatusType: 'ORDER', StatusValue: 'COMPLETED', Note: 'Người mua xác nhận đã nhận và kiểm tra sản phẩm.', ChangedBy: Number(order.BuyerId), CreatedAt: now }, transaction);
      const payload = { type: 'ORDER', title: `Đơn #${id} đã hoàn tất`, message: 'Người mua đã xác nhận nhận và kiểm tra sản phẩm.', referenceType: 'ORDER', referenceId: id, createdAt: now };
      await repository.notifyUser(order.SellerId, payload, transaction);
      await repository.notifyUser(order.BuyerId, payload, transaction);
      // C10 hiện chỉ ghi Notifications trong DB, chưa có Socket.IO/event ngoài.
      return { message: SUCCESS, data: receiptView({ ...state, order: { ...order, Status: 'COMPLETED', CompletedAt: now } }, now) };
    });
  }
  return { getPreview, confirmReceived };
}
module.exports = { ...createReceiptService(), createReceiptService, receiptPolicy, SUCCESS };
