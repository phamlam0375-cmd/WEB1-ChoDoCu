'use strict';
const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const { cancellationPolicy } = require('../D02_HuyDonHang/cancellation.service');
const { paymentPolicy } = require('../D03_ThanhToan/payment.service');
const { policy: confirmationPolicy } = require('../D04_XacNhanNhanTien/confirmation.service');
const { refundEligibility } = require('../../controllers/refunds.controller');
const v = require('../../validators/D05_TheoDoiDonHang/tracking.validator');
const defaultRepository = require('../../repositories/D05_TheoDoiDonHang/tracking.repository');

function viewer(state, user) {
  const id = Number(user?.UserId ?? user?.userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
  if (Number(state.order.BuyerId) === id) return 'BUYER';
  if (Number(state.order.SellerId) === id) return 'SELLER';
  if (state.order.DeliveryMethod === 'DELIVERY' && user.roles?.includes('DRIVER') && state.deliveries.some(row => Number(row.DriverId) === id)) return 'DRIVER';
  throw new HttpError(403, 'Bạn không có quyền theo dõi đơn hàng này.', null, 'ORDER_FORBIDDEN');
}
function progress(state) {
  const { order: o, payment: p } = state, d = o.DeliveryMethod === 'DELIVERY' ? state.deliveries[0] : null;
  if (o.Status === 'CANCELLED') return { label: 'Đơn đã hủy', description: 'Xem lý do hủy và lịch sử bên dưới.', branch: 'CANCEL' };
  if (['REFUND_PENDING', 'REFUNDED'].includes(o.Status)) return { label: o.Status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Đang xử lý hoàn tiền', description: 'Theo dõi kết quả hoàn tiền; không thanh toán lại.', branch: 'REFUND' };
  if (o.Status === 'COMPLETED') return { label: 'Đơn đã hoàn tất', description: 'Giao dịch đã được ghi nhận hoàn tất.', branch: 'COMPLETE' };
  if (o.Status === 'RESERVED') return { label: 'Chờ người bán chấp nhận', description: 'Món đang được giữ; chưa đến bước thanh toán.', branch: 'RESERVATION' };
  if (o.Status === 'WAITING_PAYMENT') {
    if (p?.Status === 'REPORTED') return { label: 'Đã báo chuyển tiền, chờ xác nhận', description: 'Thông báo chuyển tiền chưa đồng nghĩa đã thanh toán.', branch: 'PAYMENT' };
    if (p?.Status === 'REJECTED') return { label: 'Người bán chưa nhận được tiền', description: 'Kiểm tra giao dịch và gửi lại biên lai; không tự chuyển thêm tiền.', branch: 'PAYMENT' };
    return { label: 'Chờ thanh toán', description: 'Người bán đã chấp nhận đơn.', branch: 'PAYMENT' };
  }
  if (d && ['FAILED', 'RETURNING', 'RETURNED'].includes(d.Status)) return { label: { FAILED: 'Giao chưa thành công', RETURNING: 'Đang chuyển hoàn', RETURNED: 'Đã trả hàng cho người bán' }[d.Status], description: d.FailureReason || 'Xem lịch sử giao nhận và quy trình hoàn tiền liên quan.', branch: 'DELIVERY_EXCEPTION' };
  if (o.Status === 'DELIVERED' || d?.Status === 'DELIVERED') return { label: 'Đã giao, chưa hoàn tất đơn', description: 'Giao thành công không đồng nghĩa người mua đã xác nhận hoàn tất.', branch: 'DELIVERY' };
  if (o.Status === 'PAID' || o.Status === 'IN_DELIVERY') return { label: o.DeliveryMethod === 'PICKUP' ? 'Đã thanh toán · tự đến lấy' : o.Status === 'PAID' ? 'Đã thanh toán · chờ giao nhận' : 'Đang giao hàng', description: o.DeliveryMethod === 'PICKUP' ? 'Chờ người bán chuẩn bị và ghi nhận bàn giao. Không có chuyến tài xế.' : d?.DriverId ? 'Tài xế đã được phân công. Theo dõi dữ liệu giao nhận bên dưới.' : 'Chưa có tài xế nhận chuyến.', branch: o.DeliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY' };
  return { label: 'Trạng thái khác', description: 'Đọc trạng thái và lịch sử mới nhất; không tự suy ra đã hoàn tất.', branch: 'OTHER' };
}
function safeNote(row, driverOnly) {
  if (driverOnly && row.StatusType !== 'DELIVERY') return null;
  let note = row.Note || null;
  if (note?.startsWith('D04 ')) { try { note = JSON.parse(note.slice(4)).note || null; } catch { return null; } }
  if (typeof note !== 'string') return null;
  if (row.StatusType === 'PAYMENT' && row.StatusValue === 'REPORTED' && note?.startsWith('Biên lai:')) return 'Người mua đã gửi biên lai chuyển khoản.';
  if (/PasswordHash|CodeHash|Bearer\s|\btoken\b|\bOTP\b|mã (?:lấy hàng|giao hàng|xác thực)|\b[a-f0-9]{64}\b|\beyJ[A-Za-z0-9_-]+\./i.test(note)) return 'Đã ẩn nội dung bảo mật.';
  return note;
}
function summary(state) {
  const o = state.order;
  return { orderId: Number(o.OrderId), product: { listingId: Number(o.ListingId), title: state.listing?.Title || null, imageUrl: state.image || null }, seller: { userId: Number(o.SellerId), name: state.seller?.FullName || null }, createdAt: o.CreatedAt,
    deliveryMethod: o.DeliveryMethod, productAmount: o.ProductAmount, deliveryFee: o.DeliveryFee, totalAmount: o.TotalAmount, orderStatus: o.Status, paymentStatus: state.payment?.Status || null,
    deliveryStatus: o.DeliveryMethod === 'DELIVERY' ? state.deliveries[0]?.Status || null : null, progress: progress(state) };
}
function capabilities(state, role, user, now) {
  const id = state.order.OrderId, buyer = role === 'BUYER', seller = role === 'SELLER';
  const c = cancellationPolicy(state), p = paymentPolicy(state), f = confirmationPolicy(state);
  const r = refundEligibility({ ...state, now, windowDays: state.refundWindowDays });
  const action = (enabled, href, reason) => ({ enabled, href: enabled ? href : null, reason: enabled ? null : reason });
  // Marker buyer chỉ được đọc tracking; không mở quyền B06 cho demo production.
  return {
    cancel: action(buyer && c.action === 'CANCEL', `/orders/${id}/cancel`, c.detail || c.message || 'Chỉ người mua được hủy khi đơn còn phù hợp.'),
    payment: action(buyer && p.canReport, `/orders/${id}/payment`, p.code === 'SELLER_ACCEPTANCE_REQUIRED' ? 'Chờ người bán chấp nhận đơn.' : p.message),
    confirmPayment: action(seller && f.canDecide, `/seller/orders/${id}/payment`, seller ? f.message : 'Chỉ người bán của đơn được đối chiếu nhận tiền.'),
    refund: action(buyer && !user.d01Demo && r.enabled, `/orders/${id}/refund`, user.d01Demo ? 'Yêu cầu hoàn tiền cần phiên tài khoản hiện có, không dùng chế độ thử mua hàng.' : r.reason || 'Chỉ người mua được yêu cầu hoàn tiền.'),
    receive: action(false, null, 'Chức năng xác nhận nhận hàng chưa sẵn sàng.'),
    chat: action(false, null, state.order.DeliveryMethod === 'PICKUP' ? 'Đơn tự đến lấy không có tài xế.' : state.deliveries.some(d => d.DriverId) ? 'Trò chuyện theo đơn chưa sẵn sàng.' : 'Chưa thể mở trò chuyện với tài xế khi chưa được phân công.'),
  };
}
function createTrackingService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  async function listOrders(query, user) {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    const options = v.validateList(query);
    return repository.withSnapshot(async transaction => {
      const result = await repository.list(id, options, transaction);
      return { data: result.rows.map(summary), pagination: result.pagination, serverNow: clock().toISOString(), viewer: { userId: id, demo: Boolean(user.d01Demo) } };
    });
  }
  async function getTracking(orderId, query, user) {
    const id = v.validateOrderId(orderId), historyOptions = v.validateTracking(query);
    return repository.withSnapshot(async transaction => {
      const first = await repository.readState(id, transaction);
      if (!first) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
      const role = viewer(first, user), driverOnly = role === 'DRIVER';
      const state = await repository.readRelated(first, historyOptions, driverOnly, transaction), o = state.order, now = clock();
      const data = { ...summary(state), viewer: { userId: Number(user.UserId ?? user.userId), role, demo: Boolean(user.d01Demo) }, receiver: { name: o.ReceiverName, phone: o.ReceiverPhone, address: o.ReceiverAddress }, completedAt: o.CompletedAt,
        buyerNote: driverOnly ? null : o.BuyerNote, cancelReason: driverOnly ? null : o.CancelReason,
        reservedUntil: o.Status === 'RESERVED' ? o.ReservedUntil : null,
        payment: state.payment ? { status: state.payment.Status, reportedAt: state.payment.ReportedAt, confirmedAt: state.payment.ConfirmedAt, ...(driverOnly ? {} : { amount: state.payment.Amount }) } : null,
        deliveries: o.DeliveryMethod === 'DELIVERY' ? state.deliveries.map(d => ({ deliveryId: d.DeliveryId, status: d.Status, driver: d.DriverId ? { userId: d.DriverId, name: d.DriverName, phone: d.DriverPhone } : null, pickupAddress: d.PickupAddress, deliveryAddress: d.DeliveryAddress, driverFee: d.DriverFee, retryCount: d.RetryCount, failureReason: d.FailureReason, acceptedAt: d.AcceptedAt, pickedUpAt: d.PickedUpAt, deliveredAt: d.DeliveredAt, returnedAt: d.ReturnedAt })) : [],
        refunds: state.refunds.map(r => ({ refundId: r.RefundRequestId, status: r.Status, reason: r.Reason, amount: r.Amount, requestedAt: r.RequestedAt, completedAt: r.CompletedAt })),
        histories: state.histories.map(h => ({ historyId: h.HistoryId, deliveryId: h.DeliveryId, group: h.StatusType, status: h.StatusValue, at: h.CreatedAt, note: safeNote(h, driverOnly) })), historyPagination: state.historyPagination,
        capabilities: capabilities(state, role, user, now), serverNow: now.toISOString() };
      if (driverOnly) { delete data.productAmount; delete data.totalAmount; }
      // Không đưa serverNow vào version: không lặp thông báo thay đổi khi
      // polling/refresh trả lại cùng dữ liệu.
      data.version = crypto.createHash('sha256').update(JSON.stringify({ ...data, serverNow: undefined })).digest('hex');
      return data;
    });
  }
  return { listOrders, getTracking };
}
module.exports = { ...createTrackingService(), createTrackingService, viewer, progress, safeNote };
