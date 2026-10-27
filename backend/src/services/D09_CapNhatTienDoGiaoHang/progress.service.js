'use strict';
const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const { driverPolicy } = require('../D07_TaiXeNhanChuyen/assignment.service');
const { progressPolicy } = require('./progress.policy');
const v = require('../../validators/D09_CapNhatTienDoGiaoHang/progress.validator');
const defaultRepository = require('../../repositories/D09_CapNhatTienDoGiaoHang/progress.repository');
const error = (status, code, message) => new HttpError(status, message, null, code);
function createProgressService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  async function update(deliveryId, body, requestId, user) {
    const id = v.id(deliveryId), userId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0 || user?.d01Demo) throw error(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập thật để tiếp tục.');
    const input = v.update(body, requestId);
    const hash = crypto.createHash('sha256').update(JSON.stringify([id, userId, input.status, input.action, input.note])).digest('hex');
    const located = await repository.locate(id);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    try {
      return await repository.withTransaction(async tx => {
        const state = await repository.readState(located.OrderId, id, tx, true);
        if (!state?.delivery) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
        if (Number(state.delivery.DriverId) !== userId) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không có quyền cập nhật chuyến này.');
        const driver = await repository.driver(userId, tx, true), permission = driverPolicy(driver, { replay: true });
        if (!permission.allowed) throw error(403, permission.code, permission.message);
        const response = (event, alreadyApplied) => ({ message: alreadyApplied ? 'Thao tác đã được ghi nhận trước đó; không cập nhật trùng.' : 'Đã cập nhật tiến độ giao hàng.',
          data: { deliveryId: id, orderId: state.order.OrderId, deliveryStatus: state.delivery.Status, orderStatus: state.order.Status, alreadyApplied,
            event: { historyId: event.HistoryId, kind: event.StatusValue === 'PROGRESS_NOTE' ? 'NOTE' : 'START', note: event.Note, at: event.CreatedAt, actorId: event.ChangedBy },
            trackingUrl: `/orders/${state.order.OrderId}/tracking`, progressUrl: `/driver/deliveries/${id}/progress`, verification: { available: false, message: 'D13 chưa triển khai; chưa thể xác thực giao thành công.' } } });
        const existing = await repository.requestEvent(id, input.requestId, tx);
        if (existing) {
          if (existing.D09RequestHash !== hash || Number(existing.ChangedBy) !== userId) throw error(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa thao tác đã dùng cho nội dung khác. Không ghi đè request cũ.');
          // Chỉ đọc kết quả đã commit; kể cả chuyến đã tiến xa hơn cũng không kéo lùi.
          return response(existing, true);
        }
        const policy = progressPolicy(state, driver, clock());
        if (!policy.allowed) throw error(409, policy.code, policy.message);
        const start = await repository.startEvent(id, tx);
        if (input.action === 'START' && state.delivery.Status === 'DELIVERING') {
          if (!start || start.D09RequestHash !== hash) throw error(409, 'DELIVERY_ALREADY_STARTED', 'Chuyến đã bắt đầu giao. Hãy chọn thêm ghi chú tiến độ mới, không gửi lại thao tác bắt đầu với nội dung khác.');
          return response(start, true);
        }
        if (input.action === 'NOTE' && (state.delivery.Status !== 'DELIVERING' || !start)) throw error(409, 'DELIVERY_NOT_STARTED', 'Cần bắt đầu giao hàng trước khi bổ sung ghi chú.');
        const now = new Date(Math.floor(clock().getTime() / 1000) * 1000);
        if (input.action === 'START') {
          if (!await repository.start(state, userId, tx)) throw error(409, 'PROGRESS_CONFLICT', 'Đơn hoặc chuyến vừa thay đổi. Vui lòng tải lại.');
          await repository.history({ OrderId: state.order.OrderId, DeliveryId: id, StatusType: 'ORDER', StatusValue: 'IN_DELIVERY', ChangedBy: userId, CreatedAt: now, Note: 'Tài xế bắt đầu giao sau xác nhận lấy hàng D08.' }, tx);
          state.order.Status = 'IN_DELIVERY'; state.delivery.Status = 'DELIVERING';
        }
        const event = await repository.history({ OrderId: state.order.OrderId, DeliveryId: id, StatusType: 'DELIVERY',
          StatusValue: input.action === 'START' ? 'DELIVERING' : 'PROGRESS_NOTE', Note: input.note, ChangedBy: userId, CreatedAt: now,
          D09RequestId: input.requestId, D09RequestHash: hash }, tx);
        // C10 hiện là bản ghi Notifications, không có socket/outbox: cùng transaction
        // nên chỉ nhìn thấy thông báo sau commit, lỗi bất kỳ sẽ rollback tất cả.
        for (const recipient of new Set([state.order.BuyerId, state.order.SellerId])) await repository.notifyUser(recipient, { type: 'DELIVERY',
          title: input.action === 'START' ? 'Tài xế đang giao hàng' : 'Cập nhật tiến độ giao hàng',
          message: input.action === 'START' ? `Chuyến #${id} đã chuyển sang Đang giao hàng.` : `Chuyến #${id} có ghi chú tiến độ mới. Xem lịch sử đơn hàng.`,
          referenceType: 'ORDER', referenceId: state.order.OrderId, createdAt: now }, tx);
        return response(event, false);
      });
    } catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw error(409, 'PROGRESS_CONFLICT', 'Chuyến đang được xử lý. Vui lòng tải lại trước khi thử tiếp.');
      if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(code)) throw error(503, 'D09_SCHEMA_NOT_READY', 'Database chưa áp dụng migration D09.');
      throw e;
    }
  }
  return { update };
}
module.exports = { ...createProgressService(), createProgressService };
