'use strict';

const { HttpError } = require('../../utils/httpError');
const { validateOrderId } = require('../../validators/D02_HuyDonHang/cancellation.validator');
const defaultRepository = require('../../repositories/D02_HuyDonHang/cancellation.repository');

const ALLOWED_STATUSES = ['RESERVED'];

function createConfirmationService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  const identity = user => {
    const userId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    }
    return userId;
  };

  function validateInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || typeof body.action !== 'string' || !['ACCEPT', 'REJECT'].includes(body.action)
        || (body.action === 'ACCEPT' && typeof body.available !== 'boolean')
        || (body.action === 'REJECT' && body.available !== undefined)
        || Object.keys(body).some(key => !['action', 'available', 'reason'].includes(key))) {
      throw new HttpError(400, 'Dữ liệu xác nhận đơn hàng không hợp lệ.', null, 'VALIDATION_ERROR');
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if ([...reason].length > 500) {
      throw new HttpError(400, 'Lý do từ chối không được vượt quá 500 ký tự.', null, 'VALIDATION_ERROR');
    }
    return { action: body.action, available: body.available, reason: reason || null };
  }

  async function confirmOrder(orderId, body, user) {
    const id = validateOrderId(orderId);
    const input = validateInput(body);
    const sellerId = identity(user);

    return repository.withTransaction(async transaction => {
      const state = await repository.readState(id, transaction);
      if (!state) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
      if (Number(state.order.SellerId) !== sellerId) {
        throw new HttpError(403, 'Bạn không có quyền xử lý đơn hàng này.', null, 'ORDER_FORBIDDEN');
      }
      if (!ALLOWED_STATUSES.includes(state.order.Status) || state.payment || state.deliveries.length) {
        throw new HttpError(409, 'Chỉ có thể xử lý đơn hàng đang chờ người bán chấp nhận.', null, 'ORDER_NOT_CONFIRMABLE');
      }

      if (input.action === 'ACCEPT' && !input.available) {
        throw new HttpError(409, 'Không thể chấp nhận đơn hàng vì sản phẩm đã hết hàng.', null, 'LISTING_OUT_OF_STOCK');
      }

      const now = clock();
      if (input.action === 'ACCEPT') {
        if (await repository.updateOrderStatus(state.order, 'WAITING_PAYMENT', null, transaction) !== 1) {
          throw new HttpError(409, 'Đơn hàng vừa được cập nhật. Vui lòng tải lại.', null, 'ORDER_CONFLICT');
        }
        await repository.createHistory({
          OrderId: id, DeliveryId: null, StatusType: 'ORDER', StatusValue: 'WAITING_PAYMENT',
          Note: 'Người bán đã xác nhận sản phẩm còn hàng.', ChangedBy: sellerId, CreatedAt: now
        }, transaction);
        await repository.notifyUser(state.order.BuyerId, {
          type: 'ORDER', title: 'Đơn hàng đã được chấp nhận',
          message: `Người bán đã chấp nhận đơn #${id}. Vui lòng thanh toán để tiếp tục.`,
          referenceType: 'ORDER', referenceId: id, createdAt: now
        }, transaction);
        return { message: 'Đã chấp nhận đơn hàng.', data: { orderId: id, status: 'WAITING_PAYMENT', cancelReason: null } };
      }

      if (await repository.updateOrderStatus(state.order, 'CANCELLED', input.reason, transaction) !== 1) {
        throw new HttpError(409, 'Đơn hàng vừa được cập nhật. Vui lòng tải lại.', null, 'ORDER_CONFLICT');
      }

      const listingReopened = await repository.reopenListing(state.order.ListingId, transaction) === 1;
      await repository.createHistory({
        OrderId: id,
        DeliveryId: null,
        StatusType: 'ORDER',
        StatusValue: 'CANCELLED',
        Note: input.reason,
        ChangedBy: sellerId,
        CreatedAt: now
      }, transaction);

      await repository.notifyUser(state.order.BuyerId, {
        type: 'ORDER',
        title: 'Đơn hàng bị từ chối',
        message: input.reason ? `Người bán đã từ chối đơn #${id}. Lý do: ${input.reason}` : `Người bán đã từ chối đơn #${id}.`,
        referenceType: 'ORDER',
        referenceId: id,
        createdAt: now
      }, transaction);

      return {
        message: 'Đã từ chối đơn hàng',
        data: {
          orderId: id,
          status: 'CANCELLED',
          cancelReason: input.reason,
          listingReopened
        }
      };
    });
  }

  return { confirmOrder };
}

module.exports = { ...createConfirmationService(), createConfirmationService };
