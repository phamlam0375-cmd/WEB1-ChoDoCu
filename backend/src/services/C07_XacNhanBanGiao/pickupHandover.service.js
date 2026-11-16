'use strict';

const { sequelize, Orders, Payments, StatusHistories } = require('../../models');
const { HttpError } = require('../../utils/httpError');

async function confirmPickupHandover(orderId, user) {
  const id = Number(orderId);
  const sellerId = Number(user?.UserId ?? user?.userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Mã đơn hàng không hợp lệ.', null, 'ORDER_INVALID');
  if (!Number.isSafeInteger(sellerId) || sellerId < 1) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');

  return sequelize.transaction(async transaction => {
    const order = await Orders.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    if (Number(order.SellerId) !== sellerId) throw new HttpError(403, 'Bạn không phải người bán của đơn.', null, 'ORDER_FORBIDDEN');
    if (order.DeliveryMethod !== 'PICKUP') throw new HttpError(409, 'Chỉ đơn tự đến lấy mới dùng bước bàn giao này.', null, 'PICKUP_REQUIRED');
    if (order.Status === 'DELIVERED' && order.PickupHandoverAt) return { message: 'Bàn giao tự đến lấy đã được ghi nhận.', data: order };
    if (order.Status !== 'PAID' || order.CompletedAt) throw new HttpError(409, 'Đơn chưa đủ điều kiện để bàn giao.', null, 'PICKUP_HANDOVER_NOT_READY');

    const payment = await Payments.findOne({ where: { OrderId: id }, transaction, raw: true });
    if (!payment || payment.Status !== 'CONFIRMED' || Number(payment.ConfirmedBy) !== sellerId) {
      throw new HttpError(409, 'Tiền sản phẩm chưa được người bán xác nhận.', null, 'PAYMENT_NOT_CONFIRMED');
    }

    const now = new Date();
    await order.update({ Status: 'DELIVERED', PickupHandoverAt: now, PickupHandoverBy: sellerId }, { transaction });
    await StatusHistories.create({
      OrderId: id,
      DeliveryId: null,
      StatusType: 'DELIVERY',
      StatusValue: 'HANDOVER_CONFIRMED',
      Note: 'Người bán xác nhận đã bàn giao đơn PICKUP cho người mua.',
      ChangedBy: sellerId,
      CreatedAt: now,
    }, { transaction });
    return { message: 'Đã ghi nhận bàn giao tự đến lấy. Chờ người mua xác nhận nhận hàng.', data: order };
  });
}

module.exports = { confirmPickupHandover };
