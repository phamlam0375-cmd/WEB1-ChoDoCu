'use strict';
const { sequelize, Orders } = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { createPreparedDelivery } = require('../D07_TaiXeNhanChuyen/preparedDelivery.service');
const { orderRouting } = require('./orderRouting');
const v = require('../../validators/D12_UocTinhPhiGiaoHang/fee.validator');
// Nối C07 hiện tại vào snapshot đã chốt. Không tạo chuyến ở estimate, D01 hoặc D04.
async function prepare(orderId, body, user) {
  const id = v.id(orderId, 'orderId');
  if (body && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) throw new HttpError(422, 'C07 chỉ xác nhận chuẩn bị hàng; không nhận phí/tuyến/mã từ client.', null, 'PREPARATION_VALIDATION');
  return sequelize.transaction(async tx => {
    const order = await Orders.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE, raw: true });
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    if (Number(order.SellerId) !== Number(user.UserId)) throw new HttpError(403, 'Bạn không phải người bán của đơn.', null, 'ORDER_FORBIDDEN');
    const routing = orderRouting(order);
    // Điểm lấy đã chốt không đổi khi chủ cửa hàng sửa địa chỉ sau lúc đặt.
    const delivery = await createPreparedDelivery(id, { sellerId: user.UserId, readyAt: new Date(), pickupAddress: routing.pickupAddress }, routing, tx);
    return { DeliveryId: delivery.DeliveryId, OrderId: delivery.OrderId, Status: delivery.Status, DriverFee: delivery.DriverFee,
      PickupArea: delivery.PickupArea, DeliveryArea: delivery.DeliveryArea, VehicleType: delivery.VehicleType, ReadyForPickupAt: delivery.ReadyForPickupAt };
  });
}
module.exports = { prepare };
