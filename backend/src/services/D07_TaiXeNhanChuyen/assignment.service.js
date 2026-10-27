'use strict';
const { HttpError } = require('../../utils/httpError');
const v = require('../../validators/D07_TaiXeNhanChuyen/assignment.validator');
const defaultRepository = require('../../repositories/D07_TaiXeNhanChuyen/assignment.repository');
const fail = (status, code, message) => new HttpError(status, message, null, code);
const text = value => typeof value === 'string' && value.trim() && !/[\x00-\x1f\x7f]/.test(value);
function approvalPolicy(state) {
  if (!state.user || state.user.Status !== 'ACTIVE') return { allowed: false, code: 'ACCOUNT_UNAVAILABLE', message: 'Tài khoản không được phép hoạt động.' };
  if (!state.application) return { allowed: false, code: 'DRIVER_NOT_REGISTERED', message: 'Bạn chưa đủ điều kiện nhận chuyến. Hãy đăng ký DRIVER tại C01.' };
  if (state.application.Status !== 'APPROVED' || !state.hasRole) return { allowed: false, code: 'DRIVER_NOT_APPROVED', message: 'Bạn chưa đủ điều kiện nhận chuyến. Hồ sơ cần được B02 duyệt và còn quyền DRIVER.' };
  return { allowed: true };
}
function driverPolicy(state, { replay = false } = {}) {
  const approval = approvalPolicy(state);
  if (!approval.allowed) return approval;
  if (replay) return { allowed: true, code: 'ALREADY_ACCEPTED' };
  const p = state.profile;
  if (!p || !text(p.VehicleType) || !text(p.VehiclePlate) || !text(p.ServiceArea)
      || (p.MaxDistanceKm !== null && p.MaxDistanceKm !== undefined && (!Number.isFinite(Number(p.MaxDistanceKm)) || Number(p.MaxDistanceKm) <= 0))) {
    return { allowed: false, code: 'DRIVER_PROFILE_INCOMPLETE', message: 'Chưa có hồ sơ vận hành D11 hợp lệ (phương tiện, biển số, khu vực/bán kính). D11 chưa được triển khai; không tự tạo thông tin thay thế.' };
  }
  if (state.active || p.AvailabilityStatus === 'BUSY') return { allowed: false, code: 'DRIVER_BUSY', message: 'Bạn đang BUSY hoặc có chuyến chưa kết thúc; không thể nhận thêm chuyến.' };
  if (p.AvailabilityStatus !== 'AVAILABLE') return { allowed: false, code: 'DRIVER_OFFLINE', message: 'Hãy bật trạng thái sẵn sàng nhận chuyến. Chức năng cập nhật D11 hiện chưa có; D07 không tự bật AVAILABLE.' };
  return { allowed: true, code: 'AVAILABLE', message: 'Sẵn sàng xem các chuyến phù hợp.' };
}
function createAssignmentService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  function identity(user) {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id <= 0) throw fail(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
    return id;
  }
  async function run(work) {
    try { return await repository.withTransaction(work); }
    catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw fail(409, 'DELIVERY_CONFLICT', 'Chuyến đang được xử lý. Vui lòng tải lại.');
      if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(code)) throw fail(503, 'D07_SCHEMA_NOT_READY', 'Database chưa áp dụng migration tích hợp D07.');
      throw e;
    }
  }
  async function status(user) {
    const userId = identity(user);
    return run(async tx => {
      const state = await repository.driver(userId, tx);
      if (!state.user || state.user.Status !== 'ACTIVE') throw fail(403, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không được phép hoạt động.');
      const p = state.profile;
      return { policy: driverPolicy(state), application: state.application, profile: p ? {
        vehicleType: p.VehicleType, vehiclePlate: p.VehiclePlate, serviceArea: p.ServiceArea, maxDistanceKm: p.MaxDistanceKm,
        availabilityStatus: p.AvailabilityStatus,
      } : null, activeDelivery: state.active && state.hasRole && state.application?.Status === 'APPROVED' ? {
        deliveryId: state.active.DeliveryId, orderId: state.active.OrderId, status: state.active.Status,
        acceptedAt: state.active.AcceptedAt, trackingUrl: `/orders/${state.active.OrderId}/tracking`,
        pickupUrl: state.active.Status === 'ACCEPTED' && state.active.OrderStatus === 'PAID' ? `/driver/deliveries/${state.active.DeliveryId}/pickup` : null,
        progressUrl: ['PICKED_UP', 'DELIVERING'].includes(state.active.Status) && ['PAID', 'IN_DELIVERY'].includes(state.active.OrderStatus) ? `/driver/deliveries/${state.active.DeliveryId}/progress` : null,
        orderStatus: state.active.OrderStatus,
        blocked: !['PAID', 'IN_DELIVERY'].includes(state.active.OrderStatus),
      } : null, dependencies: {
        preparation: 'C07 chưa có thao tác xác nhận sẵn sàng lấy hàng; chuyến thiếu dấu xác nhận thật không xuất hiện.',
        routing: 'D12 chưa có báo giá/tuyến tin cậy. Không tự tạo khu vực, khoảng cách hoặc phí.',
        profile: 'D11 chưa có giao diện cập nhật hồ sơ/trạng thái. D07 không tự tạo hồ sơ hoặc bật AVAILABLE.',
        nextStep: 'D08 xác nhận lấy hàng sau bàn giao; D09 bắt đầu giao và ghi chú tiến độ. D13 chưa triển khai; không tự xác thực giao thành công.',
      } };
    });
  }
  async function available(query, user) {
    const filter = v.list(query), userId = identity(user);
    return run(async tx => {
      const state = await repository.driver(userId, tx), policy = driverPolicy(state);
      if (!policy.allowed) throw fail(policy.code === 'ACCOUNT_UNAVAILABLE' || policy.code.startsWith('DRIVER_NOT_') ? 403 : 409, policy.code, policy.message);
      const result = await repository.eligible(state.profile, filter, tx);
      return { data: result.rows, pagination: { page: filter.page, limit: filter.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / filter.limit)) } };
    });
  }
  async function accept(deliveryId, body, user) {
    const id = v.id(deliveryId); v.accept(body); const userId = identity(user);
    // Đọc OrderId bất biến ngoài transaction, không mở snapshot cũ trước khi lấy mutex.
    const located = await repository.locate(id);
    if (!located) throw fail(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return run(async tx => {
      const { order, delivery } = await repository.lockState(located.OrderId, id, tx);
      if (!order || !delivery) throw fail(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
      const state = await repository.driver(userId, tx, true);
      const replay = Number(delivery.DriverId) === userId && delivery.AcceptedAt;
      const approval = approvalPolicy(state);
      if (!approval.allowed) throw fail(403, approval.code, approval.message);
      const result = alreadyApplied => ({ deliveryId: id, orderId: order.OrderId, status: delivery.Status, acceptedAt: delivery.AcceptedAt,
        driverId: userId, alreadyApplied, trackingUrl: `/orders/${order.OrderId}/tracking`,
        pickupUrl: delivery.Status === 'ACCEPTED' && order.Status === 'PAID' ? `/driver/deliveries/${id}/pickup` : null });
      if (replay) return result(true);
      if (delivery.DriverId !== null) throw fail(409, 'DELIVERY_TAKEN', 'Chuyến vừa được tài xế khác nhận.');
      const policy = driverPolicy(state);
      if (!policy.allowed) throw fail(409, policy.code, policy.message);
      if (!await repository.eligible(state.profile, { id }, tx)) throw fail(409, 'DELIVERY_NOT_ELIGIBLE', 'Chuyến không còn đủ điều kiện nhận (đơn/thanh toán, C07, khu vực, phương tiện hoặc bán kính). Vui lòng tải lại.');
      // Schema chung dùng DATETIME(0); response đầu và retry cùng thời điểm đã lưu.
      const now = new Date(Math.floor(clock().getTime() / 1000) * 1000);
      if (await repository.assign(id, userId, now, tx) !== 1 || await repository.busy(userId, now, tx) !== 1) throw fail(409, 'DELIVERY_CONFLICT', 'Trạng thái đã thay đổi. Vui lòng tải lại.');
      await repository.history({ OrderId: order.OrderId, DeliveryId: id, StatusType: 'DELIVERY', StatusValue: 'ACCEPTED',
        ChangedBy: userId, CreatedAt: now, Note: 'Tài xế đã nhận chuyến; chưa xác nhận lấy hàng.' }, tx);
      for (const recipient of new Set([order.BuyerId, order.SellerId, userId])) await repository.notifyUser(recipient, {
        type: 'DELIVERY', title: 'Tài xế đã nhận chuyến', message: `Đã nhận chuyến #${id} cho đơn #${order.OrderId}. Chưa xác nhận lấy hàng.`,
        referenceType: 'ORDER', referenceId: order.OrderId, createdAt: now,
      }, tx);
      delivery.AcceptedAt = now;
      delivery.Status = 'ACCEPTED';
      return result(false);
    });
  }
  return { status, available, accept };
}
module.exports = { ...createAssignmentService(), createAssignmentService, driverPolicy };
