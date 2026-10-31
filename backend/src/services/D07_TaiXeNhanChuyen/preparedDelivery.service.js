'use strict';
const { Op } = require('sequelize');
const { Orders, Payments, Deliveries, RefundRequests } = require('../../models');
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const { HttpError } = require('../../utils/httpError');

// Điểm tích hợp SERVER cho C07 tương lai, KHÔNG có HTTP endpoint gọi trực tiếp.
// C07 phải truyền kết quả chuẩn bị thật, D12 phải truyền snapshot tuyến đã chốt.
// Không gọi từ GET, D04, startup hay job; không tự đánh dấu PAID là đã chuẩn bị.
async function createPreparedDelivery(orderId, preparation, routingSnapshot, transaction) {
  const blocked = message => new HttpError(409, message, null, 'DELIVERY_PREPARATION_INCOMPLETE');
  if (!transaction) throw new Error('C07 phải dùng cùng transaction với xác nhận chuẩn bị hàng.');
  const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  if (!order || order.DeliveryMethod !== 'DELIVERY' || order.Status !== 'PAID' || order.CompletedAt) throw blocked('Chỉ tạo chuyến cho đơn DELIVERY đã PAID và còn được phép giao.');
  const payment = await Payments.findOne({ where: { OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const existing = await Deliveries.findOne({ where: { OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const refund = await RefundRequests.findOne({ where: { OrderId: orderId, Status: { [Op.ne]: 'REJECTED' } }, transaction, raw: true });
  if (refund || !payment || payment.Status !== 'CONFIRMED' || payment.PayerId !== order.BuyerId || payment.PayeeId !== order.SellerId
      || payment.ConfirmedBy !== order.SellerId || !payment.ConfirmedAt || !payment.ReportedAt || !payment.ProofUrl?.trim()
      || !payment.TransferContent?.trim() || !snapshotBank(payment) || !matchesAmount(payment.Amount, order.ProductAmount)) throw blocked('Thanh toán D04 chưa hợp lệ hoặc đơn đang hoàn tiền.');
  const readyAt = new Date(Math.floor(new Date(preparation?.readyAt).getTime() / 1000) * 1000), confirmedAt = new Date(payment.ConfirmedAt);
  const validText = (value, max) => typeof value === 'string' && value.trim() && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
  if (Number(preparation?.sellerId) !== order.SellerId || !Number.isFinite(readyAt.getTime()) || readyAt < confirmedAt || readyAt > new Date()
      || !validText(preparation?.pickupAddress, 255) || !validText(order.ReceiverAddress, 255)) throw blocked('Thiếu xác nhận sẵn sàng/địa chỉ thực tế từ C07.');
  const r = routingSnapshot;
  if (!r || !order.DeliveryFeeRuleId || Number(r.ruleId) !== order.DeliveryFeeRuleId || !matchesAmount(r.driverFee, order.DeliveryFee)
      || !validText(r.pickupArea, 100) || !validText(r.deliveryArea, 100) || !validText(r.vehicleType, 30)
      || (r.routeDistanceKm != null && (!Number.isFinite(Number(r.routeDistanceKm)) || Number(r.routeDistanceKm) < 0 || Number(r.routeDistanceKm) > 999999.99))) throw blocked('Thiếu snapshot tuyến/phí đã chốt từ D12; không dùng giá quy tắc hiện tại.');
  const data = { OrderId: orderId, DriverId: null, Status: 'AVAILABLE', AcceptedAt: null,
    PickupAddress: preparation.pickupAddress.trim(), DeliveryAddress: order.ReceiverAddress,
    DriverFee: order.DeliveryFee, PreparedBy: order.SellerId, ReadyForPickupAt: readyAt,
    PickupArea: r.pickupArea.trim(), DeliveryArea: r.deliveryArea.trim(), VehicleType: r.vehicleType.trim(), RouteDistanceKm: r.routeDistanceKm ?? null };
  if (existing) {
    // OrderId UNIQUE, retry không ghi lại snapshot hay xóa phân công đã có.
    const same = existing.PreparedBy === data.PreparedBy && new Date(existing.ReadyForPickupAt).getTime() === readyAt.getTime()
      && existing.PickupAddress === data.PickupAddress && existing.DeliveryAddress === data.DeliveryAddress
      && existing.PickupArea === data.PickupArea && existing.DeliveryArea === data.DeliveryArea && existing.VehicleType === data.VehicleType
      && matchesAmount(existing.DriverFee, data.DriverFee)
      && (existing.RouteDistanceKm == null ? data.RouteDistanceKm == null : Number(existing.RouteDistanceKm) === Number(data.RouteDistanceKm));
    if (!same) throw blocked('Đơn đã có chuyến với snapshot khác; không tự ghi đè.');
    return existing;
  }
  return (await Deliveries.create(data, { transaction })).get({ plain: true });
}
module.exports = { createPreparedDelivery };
