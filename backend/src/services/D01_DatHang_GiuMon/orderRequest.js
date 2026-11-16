'use strict';
const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const { asApiNumber } = require('../../utils/money');
function key(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new HttpError(400, 'Idempotency-Key phải là UUID v4.', null, 'ORDER_REQUEST_INVALID');
  return value.toLowerCase();
}
const hash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
function replay(order, signature) {
  if (order.D01RequestHash !== signature) throw new HttpError(409, 'Khóa đặt hàng đã được dùng với nội dung khác. Vui lòng kiểm tra đơn đã tạo.', null, 'ORDER_REQUEST_REUSED');
  return { message: 'Yêu cầu đặt hàng đã được ghi nhận trước đó. Đã tải trạng thái hiện tại của đơn.', data: {
    orderId: Number(order.OrderId), listingId: Number(order.ListingId), status: order.Status, deliveryMethod: order.DeliveryMethod,
    productAmount: asApiNumber(order.ProductAmount), deliveryFee: asApiNumber(order.DeliveryFee), totalAmount: asApiNumber(order.TotalAmount),
    productAmountDecimal: String(order.ProductAmount), deliveryFeeDecimal: String(order.DeliveryFee), totalAmountDecimal: String(order.TotalAmount),
    reservedUntil: order.ReservedUntil ? new Date(order.ReservedUntil).toISOString() : null, alreadyApplied: true,
  } };
}
module.exports = { key, hash, replay };
