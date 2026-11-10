'use strict';
const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const { driverPolicy } = require('../D07_TaiXeNhanChuyen/assignment.service');
const rules = require('./failure.policy');
const v = require('../../validators/D10_ThatBai_HoanTra/failure.validator');
const defaultRepository = require('../../repositories/D10_ThatBai_HoanTra/failure.repository');
const error = (status, code, message) => new HttpError(status, message, null, code);
function createFailureService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  const identity = user => {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id <= 0 || user?.d01Demo) throw error(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập thật để tiếp tục.');
    return id;
  };
  async function run(work, snapshot = false) {
    try { return await (snapshot ? repository.withSnapshot : repository.withTransaction)(work); }
    catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw error(409, 'DELIVERY_CONFLICT', 'Chuyến đang được xử lý. Hãy tải lại trước khi thử tiếp.');
      if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(code)) throw error(503, 'D10_SCHEMA_NOT_READY', 'Database chưa áp dụng migration D10.');
      throw e;
    }
  }
  async function authorized(orderId, id, userId, tx, lock) {
    const state = await repository.readState(orderId, id, tx, lock);
    if (!state?.delivery) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    if (Number(state.delivery.DriverId) !== userId) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không có quyền xử lý chuyến này.');
    const driver = await repository.driver(userId, tx, lock), permission = driverPolicy(driver, { replay: true });
    if (!permission.allowed) throw error(403, permission.code, permission.message);
    return { state, driver };
  }
  function describe(s, driver) {
    const d = s.delivery;
    return { deliveryId: d.DeliveryId, orderId: s.order.OrderId, deliveryStatus: d.Status, orderStatus: s.order.Status, paymentStatus: s.payment?.Status || null,
      product: { listingId: s.order.ListingId, title: s.listing?.Title || null }, pickupAddress: d.PickupAddress, deliveryAddress: d.DeliveryAddress, pickedUpAt: d.PickedUpAt,
      ...rules.view(s, driver, clock()), trackingUrl: `/orders/${s.order.OrderId}/tracking`, progressUrl: `/driver/deliveries/${d.DeliveryId}/progress`, serverNow: clock().toISOString() };
  }
  async function getPreview(deliveryId, user) {
    const id = v.id(deliveryId), userId = identity(user), located = await repository.locate(id);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return run(async tx => {
      const { state, driver } = await authorized(located.OrderId, id, userId, tx, false);
      return describe(state, driver);
    }, true);
  }
  async function update(deliveryId, body, key, expectedVersion, route, user) {
    const id = v.id(deliveryId), userId = identity(user), input = v.validate(body, key, expectedVersion, route);
    const hash = crypto.createHash('sha256').update(JSON.stringify(['D10', id, userId, input])).digest('hex');
    const located = await repository.locate(id);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return run(async tx => {
      const { state: s, driver } = await authorized(located.OrderId, id, userId, tx, true), d = s.delivery;
      const result = (message, alreadyApplied, event) => ({ message, data: { ...describe(s, driver), alreadyApplied,
        event: { historyId: event.HistoryId, at: event.CreatedAt, actorId: event.ChangedBy } } });
      // Dùng ledger idempotency D09 hiện có, hash có namespace D10; không tạo
      // kho retry thứ hai. Kiểm tra ledger trước deadline/version hiện tại.
      const existing = await repository.requestEvent(id, input.key, tx);
      if (existing) {
        if (existing.D09RequestHash !== hash || Number(existing.ChangedBy) !== userId) throw error(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa thao tác đã dùng cho nội dung khác. Không ghi đè yêu cầu cũ.');
        return result('Thao tác D10 đã được ghi nhận; không xử lý trùng.', true, existing);
      }
      if (input.version !== rules.version(d)) throw error(409, 'DELIVERY_VERSION_CONFLICT', 'Dữ liệu chuyến đã thay đổi. Hãy kiểm tra trạng thái mới trước khi tạo thao tác khác.');
      const policy = rules.policy(s, driver, input.action, clock());
      if (!policy.allowed) throw error(409, policy.code, policy.message);
      const begun = await repository.startEvent(id, tx);
      if (!begun || !begun.D09RequestId || Number(begun.ChangedBy) !== userId || new Date(begun.CreatedAt).getTime() < new Date(d.PickedUpAt).getTime() || new Date(begun.CreatedAt).getTime() > clock().getTime()) throw error(409, 'DELIVERY_NOT_STARTED', 'Chưa có xác nhận bắt đầu giao hợp lệ qua D09.');
      const now = new Date(Math.floor(clock().getTime() / 1000) * 1000), changes = {};
      let statusValue, note = input.note, message;
      const eventData = { action: input.action, attempt: Number(d.RetryCount) + 1 };
      if (input.action === 'FAIL') {
        Object.assign(changes, { Status: 'FAILED', FailureReason: input.reason, RetryScheduledAt: null });
        statusValue = 'FAILED'; note = input.reason; eventData.reasonCode = input.reasonCode;
        s.failureCount = Number(s.failureCount) + 1;
        message = `Đã ghi nhận lần giao thất bại thứ ${s.failureCount}.`;
      } else if (input.action === 'SCHEDULE') {
        if (new Date(input.scheduledAt).getTime() <= clock().getTime()) throw error(400, 'INVALID_RETRY_TIME', 'Lịch giao lại phải nằm trong tương lai.');
        changes.RetryScheduledAt = new Date(input.scheduledAt);
        statusValue = 'RETRY_SCHEDULED'; eventData.scheduledAt = input.scheduledAt;
        message = 'Đã lưu lịch giao lại. Chưa bắt đầu giao và chưa tăng số lần giao lại.';
      } else if (input.action === 'RETRY') {
        Object.assign(changes, { Status: 'DELIVERING', RetryCount: Number(d.RetryCount) + 1, RetryScheduledAt: null });
        statusValue = 'DELIVERING'; eventData.scheduledAt = new Date(d.RetryScheduledAt).toISOString(); eventData.attempt = changes.RetryCount + 1;
        message = 'Đã bắt đầu lần giao lại; tài xế tiếp tục phụ trách và giữ trạng thái vận hành.';
      } else if (input.action === 'START_RETURN') {
        Object.assign(changes, { Status: 'RETURNING', RetryScheduledAt: null });
        statusValue = 'RETURNING'; message = 'Đã chuyển sang RETURNING và thông báo cho các bên.';
      } else {
        Object.assign(changes, { Status: 'RETURNED', ReturnedAt: now, RetryScheduledAt: null });
        statusValue = 'RETURNED'; eventData.recipientName = input.recipientName; eventData.handoverConfirmed = true;
        message = 'Đã ghi nhận bàn giao trả hàng. Đây không phải xác nhận đã hoàn tiền.';
      }
      if (await repository.change(d, changes, tx) !== 1) throw error(409, 'DELIVERY_CONFLICT', 'Chuyến vừa thay đổi. Vui lòng tải lại.');
      const event = await repository.history({ OrderId: s.order.OrderId, DeliveryId: id, StatusType: 'DELIVERY', StatusValue: statusValue,
        ChangedBy: userId, CreatedAt: now, Note: note, D10Event: eventData, D09RequestId: input.key, D09RequestHash: hash }, tx);
      s.delivery = { ...d, ...changes, D10Revision: Number(d.D10Revision) + 1 };
      if (input.action === 'CONFIRM_RETURN') {
        s.lastReturn = { ChangedBy: userId, CreatedAt: now, Note: note, D10Event: eventData };
        await repository.settleDriver(userId, id, tx, now);
      }
      // C10 là bảng Notifications hiện có: không broadcast dữ liệu đơn qua
      // socket chat công khai. Bản ghi chỉ hiện sau commit, rollback cùng nghiệp vụ.
      for (const recipient of new Set([s.order.BuyerId, s.order.SellerId, userId])) await repository.notifyUser(recipient, { type: 'DELIVERY',
        title: input.action === 'CONFIRM_RETURN' ? 'Đã ghi nhận trả kiện' : 'Cập nhật giao hàng',
        message: `Chuyến #${id}: ${message}`, referenceType: 'ORDER', referenceId: s.order.OrderId, createdAt: now }, tx);
      return result(message, false, event);
    });
  }
  return { getPreview, update };
}
module.exports = { ...createFailureService(), createFailureService };
