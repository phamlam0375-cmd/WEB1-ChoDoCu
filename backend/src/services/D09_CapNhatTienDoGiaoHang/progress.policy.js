'use strict';
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const time = value => value ? new Date(value).getTime() : NaN;
function progressPolicy(state, driver, now) {
  const { order: o, payment: p, delivery: d, refund } = state;
  const block = (code, message) => ({ allowed: false, code, message });
  if (!d || !['PICKED_UP', 'DELIVERING'].includes(d.Status)) return block('DELIVERY_NOT_PROGRESS_READY', 'Chỉ bắt đầu giao sau D08; không cập nhật chuyến chưa lấy hàng, giao thất bại hoặc đã chuyển sang bước khác.');
  if (o.DeliveryMethod !== 'DELIVERY' || o.CompletedAt || refund || o.Status !== (d.Status === 'PICKED_UP' ? 'PAID' : 'IN_DELIVERY')) return block('ORDER_NOT_PROGRESS_READY', 'Đơn không còn đủ điều kiện giao (hình thức nhận, trạng thái hoặc hoàn tiền).');
  if (!p || p.Status !== 'CONFIRMED' || Number(p.PayerId) !== Number(o.BuyerId) || Number(p.PayeeId) !== Number(o.SellerId)
    || Number(p.ConfirmedBy) !== Number(o.SellerId) || !matchesAmount(p.Amount, o.ProductAmount) || !snapshotBank(p)
    || !p.ProofUrl?.trim() || !p.TransferContent?.trim() || !Number.isFinite(time(p.ReportedAt)) || !Number.isFinite(time(p.ConfirmedAt))
    || time(p.ReportedAt) > time(p.ConfirmedAt) || time(p.ConfirmedAt) > now.getTime()) return block('PAYMENT_NOT_CONFIRMED', 'Tiền sản phẩm chưa có xác nhận D04 hợp lệ.');
  // Dấu xác nhận hiện tại do D07/C07/D08 ghi, không nhận qua payload D09.
  const times = [p.ConfirmedAt, d.ReadyForPickupAt, d.AcceptedAt, d.SellerHandoverAt, d.PickupCodeIssuedAt, d.PickedUpAt].map(time);
  if (!d.DriverId || Number(d.PreparedBy) !== Number(o.SellerId) || Number(d.SellerHandoverBy) !== Number(o.SellerId)
    || Number(d.SellerHandoverDriverId) !== Number(d.DriverId) || times.some(value => !Number.isFinite(value))
    || times.some((value, index) => index > 0 && value < times[index - 1]) || times.at(-1) > now.getTime()
    || time(d.PickupCodeUsedAt) !== time(d.PickedUpAt) || !d.PickupCodeHash
    || !(time(d.PickupCodeExpiresAt) > time(d.PickupCodeUsedAt))
    || Boolean(d.PickupProofKey) !== Boolean(d.PickupProofDigest)) return block('PICKUP_RECEIPT_INVALID', 'Thiếu hoặc không khớp dữ liệu xác nhận lấy hàng D08. Không được bỏ qua bước lấy hàng.');
  if (driver?.profile?.AvailabilityStatus !== 'BUSY' || Number(driver.active?.DeliveryId) !== Number(d.DeliveryId)) return block('DRIVER_STATE_MISMATCH', 'Hồ sơ vận hành không khớp chuyến đang phụ trách; D09 cần tài xế BUSY, không yêu cầu AVAILABLE.');
  return { allowed: true, code: 'READY', message: d.Status === 'PICKED_UP' ? 'Có thể bắt đầu giao hàng.' : 'Có thể bổ sung ghi chú tiến độ.' };
}
module.exports = { progressPolicy };
