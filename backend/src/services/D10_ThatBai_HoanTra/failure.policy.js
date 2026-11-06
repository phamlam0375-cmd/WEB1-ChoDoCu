'use strict';
const { progressPolicy } = require('../D09_CapNhatTienDoGiaoHang/progress.policy');
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const { refundEligibility } = require('../../controllers/refunds.controller');
const time = value => value ? new Date(value).getTime() : NaN;
const version = d => `"d10-${d.DeliveryId}-${d.D10Revision}-${d.Status}"`;
function moneyConfirmed(s) {
  const p = s.payment, o = s.order;
  return Boolean(p && p.Status === 'CONFIRMED' && Number(p.PayerId) === Number(o.BuyerId) && Number(p.PayeeId) === Number(o.SellerId) && Number(p.ConfirmedBy) === Number(o.SellerId) && matchesAmount(p.Amount, o.ProductAmount) && snapshotBank(p));
}
function custodyValid(s, now) {
  const d = s.delivery, o = s.order;
  if (!d || !d.DriverId || !d.PickupCodeHash || Number(d.PreparedBy) !== Number(o.SellerId) || Number(d.SellerHandoverBy) !== Number(o.SellerId) || Number(d.SellerHandoverDriverId) !== Number(d.DriverId)) return false;
  const times = [d.ReadyForPickupAt, d.AcceptedAt, d.SellerHandoverAt, d.PickupCodeIssuedAt, d.PickedUpAt].map(time);
  return times.every(Number.isFinite) && times.every((v, i) => i === 0 || v >= times[i - 1]) && times.at(-1) <= now.getTime()
    && time(d.PickupCodeUsedAt) === times.at(-1) && time(d.PickupCodeExpiresAt) > times.at(-1) && Boolean(d.PickupProofKey) === Boolean(d.PickupProofDigest);
}
function policy(s, driver, action, now) {
  const d = s.delivery, o = s.order, block = (code, message) => ({ allowed: false, code, message });
  if (o.DeliveryMethod !== 'DELIVERY' || o.CompletedAt || ['COMPLETED', 'DELIVERED'].includes(o.Status) || !d || d.DeliveredAt || d.VerifiedAt || ['DELIVERED', 'RETURNED'].includes(d.Status) || !custodyValid(s, now)) return block('DELIVERY_NOT_IN_CUSTODY', 'Chuyến không còn được xử lý D10 hoặc thiếu xác nhận lấy hàng D08 hợp lệ.');
  if (!['PAID', 'IN_DELIVERY', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED'].includes(o.Status)) return block('ORDER_STATE_INVALID', 'Trạng thái đơn chưa phù hợp để xử lý kiện đang giữ.');
  if (action === 'FAIL' && d.Status !== 'DELIVERING' || ['SCHEDULE', 'RETRY', 'START_RETURN'].includes(action) && d.Status !== 'FAILED' || action === 'CONFIRM_RETURN' && d.Status !== 'RETURNING') return block('DELIVERY_STATE_CONFLICT', 'Trạng thái chuyến đã thay đổi hoặc thao tác không đúng thứ tự; hãy tải lại.');
  if (['SCHEDULE', 'RETRY'].includes(action)) {
    const ready = progressPolicy({ ...s, delivery: { ...d, Status: 'DELIVERING' } }, driver, now);
    if (!ready.allowed) return ready;
    if (action === 'RETRY' && (!Number.isFinite(time(d.RetryScheduledAt)) || time(d.RetryScheduledAt) > now.getTime())) return block('RETRY_NOT_DUE', 'Chưa tới lịch giao lại hoặc chưa có lịch đã lưu. Không tự bắt đầu giao.');
    if (action === 'RETRY' && Number(d.RetryCount) >= 4294967295) return block('COUNTER_STORAGE_LIMIT', 'Bộ đếm đã chạm giới hạn lưu trữ, cần nhóm kiểm tra dữ liệu; không tự chuyển hoàn.');
  }
  return { allowed: true, code: 'READY', message: 'Có thể thực hiện thao tác D10.' };
}
function refundHandoff(s, role) {
  const returning = ['RETURNING', 'RETURNED'].includes(s.delivery?.Status), paid = moneyConfirmed(s);
  const eligibility = refundEligibility({ ...s, now: new Date() });
  // D05 tài xế không đọc bảng chi tiết refund: vẫn nhận biết được luồng đang
  // xử lý từ Orders.Status, không nhắc buyer tạo yêu cầu lần nữa.
  const status = s.refund?.Status || (s.order.Status === 'REFUND_PENDING' ? 'REFUND_PENDING' : s.order.Status === 'REFUNDED' ? 'COMPLETED' : null);
  return { required: returning && paid && status !== 'COMPLETED', status,
    href: returning && paid && role === 'BUYER' && eligibility.enabled ? `/orders/${s.order.OrderId}/refund?source=delivery-return` : null,
    message: !returning ? 'Giao thất bại/hẹn giao lại chưa tự khởi tạo hoàn tiền.' : !paid ? 'Chưa có khoản tiền sản phẩm được xác nhận; không tự tạo khoản hoàn tiền.' : status === 'COMPLETED' ? 'B07 đã ghi nhận hoàn tiền. Kết quả trả kiện được lưu riêng, D10 không xác nhận tiền thay B07.' : status ? 'Theo dõi yêu cầu B06–B07 hiện có; trả kiện không đồng nghĩa đã hoàn tiền.' : 'Người mua cần tự gửi yêu cầu B06 đúng đơn; người bán hoàn trực tiếp qua B07. D10 chưa tạo hoặc duyệt hoàn tiền.' };
}
function view(s, driver, now) {
  const d = s.delivery;
  return { version: version(d), retryCount: Number(d.RetryCount), failureCount: Number(s.failureCount), failureReason: d.FailureReason || null, scheduledAt: d.RetryScheduledAt || null, returnedAt: d.ReturnedAt || null,
    handover: s.lastReturn ? { recipientName: s.lastReturn.D10Event?.recipientName || null, note: s.lastReturn.Note, actorId: s.lastReturn.ChangedBy, at: s.lastReturn.CreatedAt } : null,
    actions: Object.fromEntries(['FAIL', 'SCHEDULE', 'RETRY', 'START_RETURN', 'CONFIRM_RETURN'].map(a => [a, policy(s, driver, a, now)])),
    href: `/driver/deliveries/${d.DeliveryId}/failure`, refund: refundHandoff(s, 'DRIVER') };
}
module.exports = { policy, view, version, moneyConfirmed, custodyValid, refundHandoff };
