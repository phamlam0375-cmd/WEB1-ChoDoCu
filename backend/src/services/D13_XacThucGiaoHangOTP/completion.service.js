'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { HttpError } = require('../../utils/httpError');
const { getJwtSecret } = require('../../utils/jwtSecret');
const { driverPolicy } = require('../D07_TaiXeNhanChuyen/assignment.service');
const { progressPolicy } = require('../D09_CapNhatTienDoGiaoHang/progress.policy');
const { matchesPickupCode } = require('../D08_XacNhanLayHang/pickup.service');
const v = require('../../validators/D13_XacThucGiaoHangOTP/completion.validator');
const { verifiedDelivery, time } = require('./verification.policy');
const defaultConfig = require('../../config/D13_XacThucGiaoHangOTP/completion.config');
const defaultRepository = require('../../repositories/D13_XacThucGiaoHangOTP/completion.repository');
const defaultStorage = require('./completionProof.storage');
const error = (status, code, message, details) => new HttpError(status, message, details, code);
const second = value => new Date(Math.floor(value.getTime() / 1000) * 1000);
// Pepper và namespace tách D13 khỏi D08/OTP tài khoản. Không để mã sáu số dễ dò từ DB/hash ledger.
const secretInput = (d, session, driverId, code) => crypto.createHmac('sha256', getJwtSecret()).update(JSON.stringify(['D13:code', d.OrderId, d.DeliveryId, driverId, session, code])).digest('hex');
const requestHash = (id, actorId, input, digest) => crypto.createHmac('sha256', getJwtSecret()).update(JSON.stringify(['D13:request', id, actorId, input.codeSession, input.completionCode, digest, true])).digest('hex');
const proofUrl = d => `/api/v1/orders/${d.OrderId}/deliveries/${d.DeliveryId}/completion-proof`;
function codePolicy(d, now, config = defaultConfig) {
  if (Number(d?.CompletionCodeAttempts) >= config.maxAttempts && d?.CompletionCodeHash && !d.CompletionCodeUsedAt) return { allowed: false, code: 'COMPLETION_CODE_LOCKED', message: v.LOCKED };
  if (!d?.CompletionCodeHash || !v.UUID.test(d.CompletionCodeSession || '') || d.CompletionCodeUsedAt
    || Number(d.CompletionCodeDriverId) !== Number(d.DriverId) || Number(d.CompletionCodeRunRevision) !== Number(d.D10Revision)
    || !Number.isFinite(time(d.CompletionCodeIssuedAt)) || time(d.CompletionCodeIssuedAt) > now.getTime()
    || !Number.isFinite(time(d.CompletionCodeExpiresAt)) || time(d.CompletionCodeExpiresAt) <= now.getTime()) return { allowed: false, code: 'INVALID_COMPLETION_CODE', message: v.INVALID_CODE };
  return { allowed: true, code: 'READY', message: 'Chỉ xác thực khi đã bàn giao thực tế cho người mua.' };
}
function createCompletionService({ repository = defaultRepository, storage = defaultStorage, config = defaultConfig, clock = () => new Date(),
  generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0') } = {}) {
  const identity = user => {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id <= 0 || user?.d01Demo) throw error(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập thật để tiếp tục.');
    return id;
  };
  async function run(work, snapshot = false) {
    try { return await (snapshot ? repository.withSnapshot : repository.withTransaction)(work); }
    catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw error(409, 'COMPLETION_CONFLICT', 'Đơn hoặc chuyến đang được xử lý. Hãy tải lại trước khi thử tiếp.');
      if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(code)) throw error(503, 'D13_SCHEMA_NOT_READY', 'Database chưa áp dụng migration xác thực giao hàng.');
      throw e;
    }
  }
  async function stateFor(orderId, deliveryId, tx, lock = false) {
    const state = await repository.readState(orderId, deliveryId, tx, lock);
    if (!state) throw error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    if (deliveryId && !state.delivery) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return state;
  }
  async function driverState(id, tx, lock) {
    const state = await repository.driver(id, tx, lock), permission = driverPolicy(state, { replay: true });
    if (!permission.allowed) throw error(403, permission.code, permission.message);
    return state;
  }
  async function activeActor(id, tx) {
    if ((await repository.actor(id, tx, false))?.Status !== 'ACTIVE') throw error(403, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không được phép hoạt động.');
  }
  async function deliveryPolicy(s, driver, tx) {
    if (!s.delivery || s.delivery.Status !== 'DELIVERING' || s.delivery.VerifiedAt || s.delivery.DeliveredAt || s.delivery.CompletionCodeUsedAt) return { allowed: false, code: 'DELIVERY_NOT_DELIVERING', message: 'Chỉ xác thực chuyến đang DELIVERING, chưa giao thành công hoặc chuyển hoàn.' };
    const policy = progressPolicy(s, driver, clock());
    if (!policy.allowed) return policy;
    const start = await repository.startEvent(s.delivery.DeliveryId, tx);
    if (!v.UUID.test(start?.D09RequestId || '') || Number(start.ChangedBy) !== Number(s.delivery.DriverId) || time(start.CreatedAt) < time(s.delivery.PickedUpAt) || time(start.CreatedAt) > clock().getTime()) return { allowed: false, code: 'DELIVERY_NOT_STARTED', message: 'Chưa có xác nhận bắt đầu giao hợp lệ qua D09.' };
    return { allowed: true, code: 'READY', message: 'Có thể tạo mã và xác thực tại điểm bàn giao.' };
  }
  function rate(d, now) {
    const next = time(d?.CompletionCodeIssuedAt) + config.cooldownSeconds * 1000;
    const windowEnd = time(d?.CompletionIssueWindowAt) + config.issueWindowSeconds * 1000;
    const windowActive = Number.isFinite(windowEnd) && windowEnd > now.getTime();
    return { nextIssueAt: Number.isFinite(next) ? new Date(next).toISOString() : null,
      retryAfterSeconds: Math.max(0, Number.isFinite(next) ? Math.ceil((next - now.getTime()) / 1000) : 0,
        windowActive && Number(d.CompletionIssueCount) >= config.maxIssuesPerWindow ? Math.ceil((windowEnd - now.getTime()) / 1000) : 0),
      count: windowActive ? Number(d.CompletionIssueCount) : 0, windowActive };
  }
  async function view(s, driver, role, tx) {
    const d = s.delivery, now = clock(), policy = await deliveryPolicy(s, driver, tx), codes = codePolicy(d, now, config), limit = rate(d, now);
    return { orderId: s.order.OrderId, deliveryId: d?.DeliveryId || null, orderStatus: s.order.Status, deliveryStatus: d?.Status || null, viewerRole: role,
      policy, canIssueCode: role === 'BUYER' && policy.allowed && limit.retryAfterSeconds === 0,
      canComplete: role === 'DRIVER' && policy.allowed && codes.allowed,
      code: { exists: Boolean(d?.CompletionCodeHash), session: role === 'DRIVER' ? d?.CompletionCodeSession || null : null,
        expiresAt: d?.CompletionCodeExpiresAt || null, used: Boolean(d?.CompletionCodeUsedAt), attemptsRemaining: Math.max(0, config.maxAttempts - Number(d?.CompletionCodeAttempts || 0)),
        ...limit, policy: codes, length: 6 },
      deliveredAt: d?.DeliveredAt || null, verifiedAt: d?.VerifiedAt || null, verified: verifiedDelivery(d, now), completionProofUrl: d?.CompletionProofKey && d?.VerifiedAt ? proofUrl(d) : null,
      pickupProofUrl: d?.PickupProofKey ? `/api/v1/orders/${s.order.OrderId}/deliveries/${d.DeliveryId}/pickup-proof` : null,
      trackingUrl: `/orders/${s.order.OrderId}/tracking`, receiptUrl: `/orders/${s.order.OrderId}/received`, serverNow: now.toISOString() };
  }
  async function getBuyerPreview(orderId, user) {
    const id = v.id(orderId), userId = identity(user);
    return run(async tx => {
      const s = await stateFor(id, null, tx);
      if (Number(s.order.BuyerId) !== userId) throw error(403, 'ORDER_FORBIDDEN', 'Chỉ người mua của đơn được tạo mã giao hàng.');
      await activeActor(userId, tx);
      let driver = s.delivery?.DriverId ? await repository.driver(s.delivery.DriverId, tx, false) : null;
      const permission = driver && driverPolicy(driver, { replay: true });
      const result = await view(s, driver, 'BUYER', tx);
      if (!permission?.allowed && !result.verified) { result.canIssueCode = false; result.policy = { allowed: false, code: 'DRIVER_NOT_APPROVED', message: 'Tài xế chưa có hoặc không còn đủ quyền hoạt động.' }; }
      return result;
    }, true);
  }
  async function driverOwned(deliveryId, userId, tx, lock) {
    const located = await repository.locate(deliveryId, tx);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    const s = await stateFor(located.OrderId, deliveryId, tx, lock);
    if (Number(s.delivery.DriverId) !== userId) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không phải tài xế được phân công cho chuyến này.');
    return { s, driver: await driverState(userId, tx, lock) };
  }
  async function getDriverPreview(deliveryId, user) {
    const id = v.id(deliveryId), userId = identity(user);
    return run(async tx => { const { s, driver } = await driverOwned(id, userId, tx, false); return view(s, driver, 'DRIVER', tx); }, true);
  }
  async function issueCode(orderId, body, user) {
    const id = v.id(orderId), userId = identity(user); v.issue(body);
    return run(async tx => {
      const s = await stateFor(id, null, tx, true);
      if (Number(s.order.BuyerId) !== userId) throw error(403, 'ORDER_FORBIDDEN', 'Chỉ người mua của đơn được tạo mã giao hàng.');
      await activeActor(userId, tx);
      if (!s.delivery?.DriverId) throw error(409, 'DELIVERY_NOT_ASSIGNED', 'Chưa có chuyến giao được phân công.');
      const d = s.delivery, driver = await driverState(d.DriverId, tx, true), policy = await deliveryPolicy(s, driver, tx);
      if (!policy.allowed) throw error(409, policy.code, policy.message);
      const now = second(clock()), limit = rate(d, now);
      if (limit.retryAfterSeconds) throw error(429, 'COMPLETION_CODE_COOLDOWN', 'Vui lòng chờ trước khi tạo mã giao hàng mới.', { retryAfterSeconds: limit.retryAfterSeconds });
      let code, distinct = false;
      for (let n = 0; n < 10; n++) {
        code = generateCode(); if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('D13 generator returned invalid code');
        if (d.PickupCodeHash && await matchesPickupCode(d.DeliveryId, code, d.PickupCodeHash)) continue;
        if (d.CompletionCodeHash && await bcrypt.compare(secretInput(d, d.CompletionCodeSession, d.CompletionCodeDriverId, code), d.CompletionCodeHash)) continue;
        distinct = true; break;
      }
      if (!distinct) throw error(503, 'COMPLETION_CODE_RETRY', 'Chưa tạo được mã mới. Vui lòng thử lại.');
      const session = crypto.randomUUID(), changes = { CompletionCodeSession: session, CompletionCodeDriverId: d.DriverId, CompletionCodeRunRevision: d.D10Revision,
        CompletionCodeHash: await bcrypt.hash(secretInput(d, session, d.DriverId, code), 10), CompletionCodeIssuedAt: now, CompletionCodeExpiresAt: new Date(now.getTime() + config.codeTtlSeconds * 1000),
        CompletionCodeAttempts: 0, CompletionCodeUsedAt: null, CompletionIssueWindowAt: limit.windowActive ? d.CompletionIssueWindowAt : now, CompletionIssueCount: limit.count + 1 };
      if (await repository.issueCode(d, changes, tx) !== 1) throw error(409, 'COMPLETION_CONFLICT', 'Chuyến vừa thay đổi. Hãy tải lại.');
      s.delivery = { ...d, ...changes };
      return { message: 'Mã giao hàng đã được tạo. Chỉ cung cấp khi bàn giao thực tế; mã cũ đã hết hiệu lực.', data: { ...await view(s, driver, 'BUYER', tx), completionCode: code } };
    });
  }
  async function authorizeUpload(deliveryId, requestId, user) {
    const id = v.id(deliveryId), key = v.key(requestId), userId = identity(user);
    return run(async tx => {
      const { s, driver } = await driverOwned(id, userId, tx, false), event = await repository.requestEvent(id, key, tx);
      if (event) {
        if (event.StatusValue !== 'DELIVERED' || Number(event.ChangedBy) !== userId || !verifiedDelivery(s.delivery, clock())) throw error(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa thao tác đã được dùng cho nội dung khác.');
        return;
      }
      const policy = await deliveryPolicy(s, driver, tx);
      if (!policy.allowed) throw error(409, policy.code, policy.message);
      const codes = codePolicy(s.delivery, clock(), config);
      if (codes.code === 'COMPLETION_CODE_LOCKED') throw error(429, codes.code, codes.message);
    }, true);
  }
  async function complete(deliveryId, body, file, requestId, user) {
    const id = v.id(deliveryId), key = v.key(requestId), userId = identity(user); v.whitelist(body);
    let saved;
    try {
      const result = await run(async tx => {
        const { s, driver } = await driverOwned(id, userId, tx, true), d = s.delivery;
        const result = async alreadyApplied => ({ message: alreadyApplied ? 'Đã xác thực giao hàng trước đó; không xử lý trùng.' : 'Đã xác nhận giao hàng; chuyến chuyển sang DELIVERED.', data: { ...await view(s, await repository.driver(userId, tx, false), 'DRIVER', tx), alreadyApplied } });
        const event = await repository.requestEvent(id, key, tx);
        if (event) {
          if (event.StatusValue !== 'DELIVERED' || Number(event.ChangedBy) !== userId || !verifiedDelivery(d, clock())) throw error(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa thao tác đã được dùng cho nội dung khác.');
          if (file || Object.keys(body).length) {
            const input = v.complete(body); v.image(file);
            const digest = crypto.createHash('sha256').update(file.buffer).digest('hex');
            if (event.D09RequestHash !== requestHash(id, userId, input, digest)) throw error(409, 'IDEMPOTENCY_KEY_REUSED', 'Nội dung retry khác yêu cầu đã lưu; không ghi đè bằng chứng.');
          }
          return result(true); // Không so/tiêu thụ lại OTP, kể cả D06 đã COMPLETED.
        }
        const policy = await deliveryPolicy(s, driver, tx);
        if (!policy.allowed) throw error(409, policy.code, policy.message);
        const input = v.complete(body), extension = v.image(file);
        if (input.codeSession !== d.CompletionCodeSession) throw error(409, 'COMPLETION_SESSION_CHANGED', 'Phiên mã đã thay đổi. Hãy tải lại và nhận mã mới từ người mua.');
        const codes = codePolicy(d, clock(), config);
        if (!codes.allowed) throw error(codes.code === 'COMPLETION_CODE_LOCKED' ? 429 : 422, codes.code, codes.message);
        if (!await bcrypt.compare(secretInput(d, input.codeSession, d.DriverId, input.completionCode), d.CompletionCodeHash)) {
          if (await repository.failedAttempt(d, tx) !== 1) throw error(409, 'COMPLETION_CONFLICT', 'Phiên mã đã thay đổi. Hãy tải lại.');
          // Commit bộ đếm rồi mới trả lỗi HTTP; không rollback lượt sai.
          return { failure: Number(d.CompletionCodeAttempts) + 1 >= config.maxAttempts ? error(429, 'COMPLETION_CODE_LOCKED', v.LOCKED) : error(422, 'INVALID_COMPLETION_CODE', v.INVALID_CODE) };
        }
        saved = await storage.save(file.buffer, extension);
        const now = second(clock());
        if (time(d.CompletionCodeExpiresAt) <= now.getTime()) throw error(422, 'INVALID_COMPLETION_CODE', v.INVALID_CODE);
        const digest = crypto.createHash('sha256').update(file.buffer).digest('hex'), changes = { Status: 'DELIVERED', VerifiedAt: now, DeliveredAt: now, CompletionCodeUsedAt: now, CompletionProofKey: saved.key, CompletionProofDigest: digest };
        if (!await repository.complete(s, changes, tx)) throw error(409, 'COMPLETION_CONFLICT', 'Trạng thái đơn, chuyến hoặc phiên mã đã thay đổi. Hãy tải lại.');
        await repository.history({ OrderId: s.order.OrderId, DeliveryId: id, StatusType: 'DELIVERY', StatusValue: 'DELIVERED', ChangedBy: userId, CreatedAt: now,
          Note: 'Tài xế xác thực mã giao hàng, ảnh bàn giao và xác nhận đã bàn giao thực tế.', D09RequestId: key, D09RequestHash: requestHash(id, userId, input, digest) }, tx);
        await repository.history({ OrderId: s.order.OrderId, DeliveryId: id, StatusType: 'ORDER', StatusValue: 'DELIVERED', ChangedBy: userId, CreatedAt: now, Note: 'Đã xác thực giao hàng; chờ người mua kiểm tra và xác nhận nhận hàng.' }, tx);
        await repository.settleDriver(userId, id, tx, now);
        for (const recipient of new Set([s.order.BuyerId, s.order.SellerId])) await repository.notifyUser(recipient, { type: 'DELIVERY', title: 'Đã xác thực giao hàng',
          message: `Chuyến #${id} đã giao thành công. Người mua kiểm tra sản phẩm và tiếp tục xác nhận nhận hàng hoặc yêu cầu hỗ trợ.`, referenceType: 'ORDER', referenceId: s.order.OrderId, createdAt: now }, tx);
        s.order.Status = 'DELIVERED'; s.delivery = { ...d, ...changes, D10Revision: Number(d.D10Revision) + 1, HasD13Event: true, CompletionProofAvailable: true };
        return result(false);
      });
      if (result.failure) throw result.failure;
      return result;
    } catch (e) {
      if (saved) { try { if (!await repository.proofIsReferenced(saved.key)) await storage.remove(saved); } catch { console.error('D13: giữ file vì chưa xác minh được kết quả commit.'); } }
      throw e;
    }
  }
  async function getProof(orderId, deliveryId, user) {
    const oid = v.id(orderId), did = v.id(deliveryId), userId = identity(user);
    return run(async tx => {
      const s = await stateFor(oid, did, tx), d = s.delivery; await activeActor(userId, tx);
      if (userId !== Number(s.order.BuyerId) && userId !== Number(s.order.SellerId)) {
        if (userId !== Number(d.DriverId)) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không có quyền xem bằng chứng giao hàng.');
        await driverState(userId, tx, false);
      }
      if (!verifiedDelivery(d, clock())) throw error(404, 'COMPLETION_PROOF_NOT_FOUND', 'Chưa có bằng chứng giao hàng hợp lệ.');
      return storage.resolve(d.CompletionProofKey);
    }, true);
  }
  return { getBuyerPreview, getDriverPreview, issueCode, authorizeUpload, complete, getProof };
}
module.exports = { ...createCompletionService(), createCompletionService, codePolicy };
