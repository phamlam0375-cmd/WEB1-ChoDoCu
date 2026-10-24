'use strict';

const { HttpError } = require('../../utils/httpError');
const { validateOrderId, validateCancelReason } = require('../../validators/D02_HuyDonHang/cancellation.validator');
const defaultRepository = require('../../repositories/D02_HuyDonHang/cancellation.repository');

const ALLOWED_STATUSES = ['RESERVED'];

function createRejectionService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  const identity = user => {
    const userId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    }
    return userId;
  };

  async function rejectOrder(orderId, body, user) {
    const id = validateOrderId(orderId);
    const reason = validateCancelReason(body);
    const sellerId = identity(user);

    return repository.withTransaction(async transaction => {
      const state = await repository.readState(id, transaction);
      if (!state) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
      if (Number(state.order.SellerId) !== sellerId) {
        throw new HttpError(403, 'Bạn không có quyền từ chối đơn hàng này.', null, 'ORDER_FORBIDDEN');
      }
      if (!ALLOWED_STATUSES.includes(state.order.Status) || state.payment || state.deliveries.length) {
        throw new HttpError(409, 'Chỉ có thể từ chối đơn hàng đang chờ người bán chấp nhận.', null, 'ORDER_NOT_REJECTABLE');
      }

      const rejectionReason = `Người bán từ chối: ${reason}`;
      if (await repository.markCancelled(state.order, rejectionReason, transaction) !== 1) {
        throw new HttpError(409, 'Đơn hàng vừa được cập nhật. Vui lòng tải lại.', null, 'ORDER_CONFLICT');
      }

      const listingReopened = await repository.reopenListing(state.order.ListingId, transaction) === 1;
      const now = clock();
      await repository.createHistory({
        OrderId: id,
        DeliveryId: null,
        StatusType: 'ORDER',
        StatusValue: 'CANCELLED',
        Note: rejectionReason,
        ChangedBy: sellerId,
        CreatedAt: now
      }, transaction);

      await repository.notifyUser(state.order.BuyerId, {
        type: 'ORDER',
        title: 'Đơn hàng bị từ chối',
        message: `Người bán đã từ chối đơn #${id}. Lý do: ${reason}`,
        referenceType: 'ORDER',
        referenceId: id,
        createdAt: now
      }, transaction);

      return {
        message: `Đã từ chối đơn #${id}.`,
        data: {
          orderId: id,
          status: 'CANCELLED',
          cancelReason: rejectionReason,
          listingReopened
        }
      };
    });
  }

  return { rejectOrder };
}

module.exports = { ...createRejectionService(), createRejectionService };
