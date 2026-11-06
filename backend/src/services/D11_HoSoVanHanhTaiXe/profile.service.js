'use strict';
const { HttpError } = require('../../utils/httpError');
const repository = require('../../repositories/D11_HoSoVanHanhTaiXe/profile.repository');
const { driverPolicy } = require('../D07_TaiXeNhanChuyen/assignment.service');
const v = require('../../validators/D11_HoSoVanHanhTaiXe/profile.validator');
const storage = require('./qr.storage');
const fail = (status, code, message, details) => new HttpError(status, message, details, code);
function identity(user) {
  const id = Number(user?.UserId ?? user?.userId);
  if (!Number.isSafeInteger(id) || id <= 0) throw fail(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
  return id;
}
function authorize(state) {
  if (!driverPolicy(state, { replay: true }).allowed) throw fail(403, 'DRIVER_NOT_APPROVED', 'Chỉ tài xế đã được duyệt mới được cập nhật hồ sơ vận hành.', { applicationStatus: state.application?.Status || null });
}
function unoccupied(state) {
  if (state.active) throw fail(409, 'DRIVER_BUSY', 'Không thể cập nhật hồ sơ hoặc trạng thái khi chuyến hiện tại chưa kết thúc.', { deliveryId: state.active.DeliveryId, trackingUrl: `/orders/${state.active.OrderId}/tracking` });
}
function dto(state) {
  const { profile, active, application } = state;
  return { profile, application: application ? { Status: application.Status, ReviewNote: application.ReviewNote } : null,
    readiness: v.readiness(profile, state.qrValid), qrValid: state.qrValid,
    activeDelivery: active ? { deliveryId: active.DeliveryId, status: active.Status, trackingUrl: `/orders/${active.OrderId}/tracking` } : null };
}
async function run(work) {
  try { return await repository.withTransaction(work); }
  catch (e) {
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e.original?.code || e.parent?.code)) throw fail(409, 'PROFILE_CONFLICT', 'Hồ sơ hoặc chuyến đang được cập nhật. Vui lòng tải lại.');
    throw e;
  }
}
async function get(user) {
  const id = identity(user);
  const data = await run(async tx => { const state = await repository.state(id, tx); authorize(state); return dto(state); });
  return { ...data, vehicleTypes: await repository.vehicleTypes(), fieldLimits: v.limits, qrMaxBytes: 5 * 1024 * 1024 };
}
async function patch(body, upload, user) {
  const id = identity(user), values = v.patch(body);
  if (upload && values.RemoveQr) throw fail(400, 'PROFILE_VALIDATION', 'Không thể vừa thay vừa xóa QR.');
  let saved;
  try {
    return await run(async tx => {
      const state = await repository.state(id, tx, true); authorize(state); unoccupied(state);
      const { RemoveQr, ...fields } = values;
      const next = { ...state.profile, ...fields };
      v.validateMerged(next);
      if (upload) { saved = await storage.save(id, upload); next.QrImageUrl = saved.url; fields.QrImageUrl = saved.url; }
      else if (RemoveQr) { next.QrImageUrl = null; fields.QrImageUrl = null; }
      const qrValid = await storage.valid(id, next.QrImageUrl);
      if (state.profile?.AvailabilityStatus === 'AVAILABLE' && !v.readiness(next, qrValid).ready) throw fail(409, 'RECEIVING_REQUIRED', 'Vui lòng bổ sung tài khoản hoặc QR nhận phí. Hãy chuyển OFFLINE trước khi xóa phương thức cuối cùng.');
      const now = new Date();
      if (!state.profile) await repository.create({ ...fields, UserId: id, AvailabilityStatus: 'OFFLINE', UpdatedAt: now }, tx);
      else await repository.update(id, { ...fields, UpdatedAt: now }, tx);
      return dto(await repository.state(id, tx));
    });
  } catch (error) {
    // Kể cả mất phản hồi COMMIT: chỉ dọn file mới khi chắc chắn không có tham chiếu.
    if (saved) { try { if (!await repository.referenced(saved.url)) await storage.remove(saved); } catch { /* Giữ ảnh nếu chưa biết transaction có commit. */ } }
    throw error;
  }
  // Ảnh cũ bất biến được giữ trong kho riêng; không xóa tham chiếu của chức năng khác.
}
async function availability(body, user) {
  const id = identity(user), status = v.availability(body);
  return run(async tx => {
    const state = await repository.state(id, tx, true); authorize(state); unoccupied(state);
    if (!state.profile) throw fail(409, 'PROFILE_REQUIRED', 'Vui lòng nhập đầy đủ thông tin vận hành.');
    if (status === 'AVAILABLE') {
      if (v.operationErrors(state.profile).length) throw fail(409, 'PROFILE_REQUIRED', 'Vui lòng nhập đầy đủ thông tin vận hành.');
      if (!v.readiness(state.profile, state.qrValid).ready) throw fail(409, 'RECEIVING_REQUIRED', 'Vui lòng bổ sung tài khoản hoặc QR nhận phí.');
    }
    await repository.update(id, { AvailabilityStatus: status, UpdatedAt: new Date() }, tx);
    return dto(await repository.state(id, tx));
  });
}
async function qr(key, user) {
  const id = identity(user);
  return run(async tx => {
    const state = await repository.state(id, tx); authorize(state);
    const url = `${storage.prefix}${key}`;
    if (state.profile?.QrImageUrl !== url || !state.qrValid) throw fail(404, 'QR_NOT_FOUND', 'Không tìm thấy QR nhận phí của bạn.');
    return storage.resolve(id, url);
  });
}
module.exports = { get, patch, availability, qr };
