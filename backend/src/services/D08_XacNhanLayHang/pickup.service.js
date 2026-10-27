'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { HttpError } = require('../../utils/httpError');
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const { driverPolicy } = require('../D07_TaiXeNhanChuyen/assignment.service');
const v = require('../../validators/D08_XacNhanLayHang/pickup.validator');
const defaultRepository = require('../../repositories/D08_XacNhanLayHang/pickup.repository');
const defaultStorage = require('./pickupProof.storage');
const { progressPolicy } = require('../D09_CapNhatTienDoGiaoHang/progress.policy');

// Lựa chọn kỹ thuật D08, không phải giá trị được quy định trong tài liệu nhóm.
const CODE_TTL_SECONDS = 600, RESEND_SECONDS = 60, MAX_ATTEMPTS = 5;
const error = (status, code, message, details) => new HttpError(status, message, details, code);
const time = value => value ? new Date(value).getTime() : NaN;
const secondsDate = value => new Date(Math.floor(value.getTime() / 1000) * 1000);
const secretInput = (id, code) => `D08:${id}:${code}`;
const invalidCode = () => error(422, 'INVALID_PICKUP_CODE', v.INVALID_CODE);
const proofUrl = d => `/api/v1/orders/${d.OrderId}/deliveries/${d.DeliveryId}/pickup-proof`;
function businessPolicy(state, now) {
  const { order: o, payment: p, delivery: d, refund } = state;
  const block = (code, message) => ({ allowed: false, code, message });
  if (!d) return block('DELIVERY_NOT_ASSIGNED', 'Chưa có chuyến giao được tài xế nhận qua D07.');
  if (o.DeliveryMethod !== 'DELIVERY' || o.Status !== 'PAID' || o.CompletedAt || refund) return block('ORDER_NOT_PICKUP_READY', 'Đơn không còn được phép lấy hàng (hình thức nhận, trạng thái hoặc hoàn tiền).');
  if (d.Status !== 'ACCEPTED' || !d.DriverId || !Number.isFinite(time(d.AcceptedAt)) || time(d.AcceptedAt) > now.getTime()
      || d.PickedUpAt || d.PickupCodeUsedAt || d.PickupProofKey || d.PickupProofDigest) return block('DELIVERY_NOT_ACCEPTED', 'Chuyến không còn ở bước xác nhận lấy hàng; hãy tải lại để xem tiến trình.');
  if (!p || p.Status !== 'CONFIRMED' || Number(p.PayerId) !== Number(o.BuyerId) || Number(p.PayeeId) !== Number(o.SellerId)
      || Number(p.ConfirmedBy) !== Number(o.SellerId) || !matchesAmount(p.Amount, o.ProductAmount) || !snapshotBank(p)
      || !p.ProofUrl?.trim() || !p.TransferContent?.trim() || !Number.isFinite(time(p.ReportedAt)) || !Number.isFinite(time(p.ConfirmedAt))
      || time(p.ReportedAt) > time(p.ConfirmedAt) || time(p.ConfirmedAt) > now.getTime()) return block('PAYMENT_NOT_CONFIRMED', 'Tiền sản phẩm chưa được xác nhận hợp lệ qua D04.');
  if (Number(d.PreparedBy) !== Number(o.SellerId) || !Number.isFinite(time(d.ReadyForPickupAt))
      || time(d.ReadyForPickupAt) < time(p.ConfirmedAt) || time(d.ReadyForPickupAt) > time(d.AcceptedAt)) return block('SELLER_PREPARATION_REQUIRED', 'Chưa có xác nhận chuẩn bị hàng hợp lệ từ C07; không tự suy diễn từ trạng thái PAID.');
  return { allowed: true, code: 'READY', message: 'Đối chiếu đúng kiện trước khi xác nhận.' };
}
function handoverValid(state, now) {
  const { delivery: d, order: o } = state;
  return d && Number(d.SellerHandoverBy) === Number(o.SellerId) && Number(d.SellerHandoverDriverId) === Number(d.DriverId)
    && Number.isFinite(time(d.SellerHandoverAt)) && time(d.SellerHandoverAt) >= time(d.AcceptedAt) && time(d.SellerHandoverAt) <= now.getTime();
}
function codePolicy(state, now) {
  if (!handoverValid(state, now)) return { allowed: false, code: 'SELLER_HANDOVER_REQUIRED', message: 'Chờ đúng người bán chủ động xác nhận bàn giao và cung cấp mã lấy hàng.' };
  const d = state.delivery;
  if (!d.PickupCodeHash || !Number.isFinite(time(d.PickupCodeIssuedAt)) || time(d.PickupCodeIssuedAt) > now.getTime()
      || !Number.isFinite(time(d.PickupCodeExpiresAt)) || time(d.PickupCodeExpiresAt) <= now.getTime() || d.PickupCodeUsedAt) return { allowed: false, code: 'INVALID_PICKUP_CODE', message: v.INVALID_CODE };
  if (Number(d.PickupCodeAttempts) >= MAX_ATTEMPTS) return { allowed: false, code: 'PICKUP_CODE_RATE_LIMITED', message: 'Đã vượt giới hạn thử mã. Hãy nhờ người bán cấp lại mã khi hết thời gian chờ.' };
  return { allowed: true, code: 'READY', message: 'Nhập mã do người bán cung cấp trực tiếp tại điểm bàn giao.' };
}
function createPickupService({ repository = defaultRepository, storage = defaultStorage, clock = () => new Date(),
  generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0') } = {}) {
  const identity = user => {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id <= 0 || user.d01Demo) throw error(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập thật để tiếp tục.');
    return id;
  };
  async function run(work, readOnly = false) {
    try { return await (readOnly ? repository.withSnapshot : repository.withTransaction)(work); }
    catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw error(409, 'PICKUP_CONFLICT', 'Chuyến đang được xử lý. Vui lòng tải lại trước khi thử tiếp.');
      if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(code)) throw error(503, 'D08_SCHEMA_NOT_READY', 'Database chưa áp dụng migration D08.');
      throw e;
    }
  }
  async function activeActor(id, tx, lock) {
    const actor = await repository.actor(id, tx, lock);
    if (!actor || actor.Status !== 'ACTIVE') throw error(403, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không được phép hoạt động.');
  }
  async function driverState(id, tx, lock) {
    const driver = await repository.driver(id, tx, lock), policy = driverPolicy(driver, { replay: true });
    if (!policy.allowed) throw error(403, policy.code, policy.message);
    return driver;
  }
  function operatingPolicy(driver, state) {
    return driver?.profile?.AvailabilityStatus === 'BUSY' && Number(driver.active?.DeliveryId) === Number(state.delivery?.DeliveryId)
      ? { allowed: true } : { allowed: false, code: 'DRIVER_STATE_MISMATCH', message: 'Hồ sơ vận hành không khớp chuyến đang thực hiện. D08 không yêu cầu AVAILABLE và không tự đổi trạng thái tài xế.' };
  }
  async function stateFor(orderId, deliveryId, tx, lock = false) {
    const state = await repository.readState(orderId, deliveryId, tx, lock);
    if (!state) throw error(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    if (deliveryId && !state.delivery) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return state;
  }
  function view(state, driver, role, now) {
    const d = state.delivery, policy = businessPolicy(state, now);
    const operating = d ? operatingPolicy(driver, state) : { allowed: false, code: 'DELIVERY_NOT_ASSIGNED', message: 'Chưa có tài xế nhận chuyến.' };
    const base = !policy.allowed ? policy : !operating.allowed ? operating : { allowed: true };
    const codes = d ? codePolicy(state, now) : base;
    const nextIssueAt = d?.PickupCodeIssuedAt ? new Date(time(d.PickupCodeIssuedAt) + RESEND_SECONDS * 1000) : null;
    return { orderId: state.order.OrderId, deliveryId: d?.DeliveryId || null, viewerRole: role, orderStatus: state.order.Status, deliveryStatus: d?.Status || null,
      product: { listingId: state.order.ListingId, title: state.listing?.Title || null, condition: state.listing?.ConditionLevel || null, knownDefects: state.listing?.KnownDefects || null },
      seller: { userId: state.order.SellerId, name: state.seller?.FullName || null, phone: state.seller?.Phone || null },
      driverId: d?.DriverId || null, pickupAddress: d?.PickupAddress || null, deliveryAddress: d?.DeliveryAddress || null, acceptedAt: d?.AcceptedAt || null, pickedUpAt: d?.PickedUpAt || null,
      sellerHandoverAt: d?.SellerHandoverAt || null, pickupProofUrl: d?.PickupProofKey ? proofUrl(d) : null,
      code: { exists: Boolean(d?.PickupCodeHash), expiresAt: d?.PickupCodeExpiresAt || null, used: Boolean(d?.PickupCodeUsedAt), nextIssueAt,
        attemptsRemaining: d ? Math.max(0, MAX_ATTEMPTS - Number(d.PickupCodeAttempts)) : 0, length: 6 },
      policy: role === 'SELLER' ? base : !base.allowed ? base : codes,
      canIssueCode: role === 'SELLER' && base.allowed && (!nextIssueAt || nextIssueAt <= now),
      canConfirm: role === 'DRIVER' && base.allowed && codes.allowed,
      progress: role === 'DRIVER' && d ? { href: `/driver/deliveries/${d.DeliveryId}/progress`, ...progressPolicy(state, driver, now) } : null,
      trackingUrl: `/orders/${state.order.OrderId}/tracking`, nextStep: 'D09 cập nhật tiến độ sau lấy hàng. D13 chưa triển khai; không tự xác thực giao thành công hoặc hoàn tất đơn.', serverNow: now.toISOString() };
  }
  async function getDriverPreview(deliveryId, user) {
    const id = v.id(deliveryId), userId = identity(user), located = await repository.locate(id);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    return run(async tx => {
      const state = await stateFor(located.OrderId, id, tx);
      if (Number(state.delivery.DriverId) !== userId) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không phải tài xế được phân công cho chuyến này.');
      return view(state, await driverState(userId, tx, false), 'DRIVER', clock());
    }, true);
  }
  async function getSellerPreview(orderId, user) {
    const id = v.id(orderId), userId = identity(user);
    return run(async tx => {
      const state = await stateFor(id, null, tx);
      if (Number(state.order.SellerId) !== userId) throw error(403, 'ORDER_FORBIDDEN', 'Chỉ người bán của đơn được cấp mã bàn giao.');
      await activeActor(userId, tx, false);
      const driver = state.delivery?.DriverId ? await repository.driver(state.delivery.DriverId, tx, false) : null;
      const result = view(state, driver, 'SELLER', clock());
      if (driver && !driverPolicy(driver, { replay: true }).allowed) { result.canIssueCode = false; result.policy = { allowed: false, code: 'DRIVER_NOT_APPROVED', message: 'Tài xế được phân công không còn đủ quyền hoạt động.' }; }
      return result;
    }, true);
  }
  async function issueCode(orderId, body, user) {
    const id = v.id(orderId), userId = identity(user); v.issue(body);
    return run(async tx => {
      const state = await stateFor(id, null, tx, true);
      if (Number(state.order.SellerId) !== userId) throw error(403, 'ORDER_FORBIDDEN', 'Chỉ người bán của đơn được cấp mã bàn giao.');
      await activeActor(userId, tx, true);
      const now = secondsDate(clock()), policy = businessPolicy(state, now);
      if (!policy.allowed) throw error(409, policy.code, policy.message);
      const d = state.delivery, driver = await driverState(d.DriverId, tx, true), operating = operatingPolicy(driver, state);
      if (!operating.allowed) throw error(409, operating.code, operating.message);
      if (d.SellerHandoverAt && !handoverValid(state, now)) throw error(409, 'HANDOVER_DATA_MISMATCH', 'Dấu bàn giao không khớp người bán/tài xế; không tự ghi đè.');
      const elapsed = now.getTime() - time(d.PickupCodeIssuedAt);
      if (Number.isFinite(elapsed) && elapsed < RESEND_SECONDS * 1000) throw error(429, 'PICKUP_CODE_COOLDOWN', 'Vui lòng chờ trước khi tạo mã mới.', { retryAfterSeconds: Math.ceil((RESEND_SECONDS * 1000 - elapsed) / 1000) });
      let code, distinct = false;
      for (let n = 0; n < 5; n++) {
        code = generateCode();
        if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('D08 code generator returned invalid format');
        // Không để lần cấp lại ngẫu nhiên trùng chính mã cũ còn bị người khác giữ.
        if (!d.PickupCodeHash || !await bcrypt.compare(secretInput(d.DeliveryId, code), d.PickupCodeHash)) { distinct = true; break; }
      }
      if (!distinct) throw error(503, 'PICKUP_CODE_GENERATION_RETRY', 'Chưa tạo được mã mới. Vui lòng thử lại.');
      const changes = { PickupCodeHash: await bcrypt.hash(secretInput(d.DeliveryId, code), 10), PickupCodeIssuedAt: now,
        PickupCodeExpiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000), PickupCodeAttempts: 0,
        ...(!d.SellerHandoverAt ? { SellerHandoverAt: now, SellerHandoverBy: userId, SellerHandoverDriverId: d.DriverId } : {}) };
      if (await repository.issueCode(d, changes, tx) !== 1) throw error(409, 'PICKUP_CONFLICT', 'Chuyến đã thay đổi. Vui lòng tải lại.');
      if (!d.SellerHandoverAt) await repository.history({ OrderId: id, DeliveryId: d.DeliveryId, StatusType: 'DELIVERY', StatusValue: 'HANDOVER_CONFIRMED',
        ChangedBy: userId, CreatedAt: now, Note: 'Người bán xác nhận bàn giao cho đúng tài xế đã được phân công.' }, tx);
      await repository.notifyUser(d.DriverId, { type: 'DELIVERY', title: d.PickupCodeHash ? 'Người bán đã cấp lại mã bàn giao' : 'Người bán xác nhận bàn giao',
        message: `Chuyến #${d.DeliveryId}: đối chiếu kiện và nhận mã trực tiếp từ người bán tại điểm lấy hàng.`, referenceType: 'ORDER', referenceId: id, createdAt: now }, tx);
      state.delivery = { ...d, ...changes };
      // Chỉ POST của đúng seller nhận mã rõ một lần. Không đưa vào GET/history/notify.
      return { message: 'Đã cấp mã lấy hàng. Chỉ cung cấp cho đúng tài xế tại điểm bàn giao.', data: { ...view(state, driver, 'SELLER', now), pickupCode: code } };
    });
  }
  async function confirm(deliveryId, body, file, user) {
    const id = v.id(deliveryId), userId = identity(user), input = v.pickup(body), extension = v.image(file);
    const digest = file ? crypto.createHash('sha256').update(file.buffer).digest('hex') : null;
    const located = await repository.locate(id);
    if (!located) throw error(404, 'DELIVERY_NOT_FOUND', 'Không tìm thấy chuyến.');
    let saved;
    try {
      const result = await run(async tx => {
        const state = await stateFor(located.OrderId, id, tx, true), d = state.delivery;
        if (Number(d.DriverId) !== userId) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không phải tài xế được phân công cho chuyến này.');
        const driver = await driverState(userId, tx, true);
        // Retry giữ nguyên thời điểm/ảnh, kể cả khi chuyến đã tiến xa hơn.
        if (d.PickedUpAt && d.PickupCodeUsedAt) {
          const same = d.PickupProofDigest === digest && d.PickupCodeHash && await bcrypt.compare(secretInput(id, input.pickupCode), d.PickupCodeHash);
          if (!same) throw error(409, 'PICKUP_ALREADY_CONFIRMED', 'Chuyến đã xác nhận lấy hàng; dữ liệu gửi lại khác, không ghi đè ảnh hoặc thời điểm. Hãy tải lại.');
          return { message: 'Đã ghi nhận lấy kiện trước đó; không xử lý trùng.', data: { ...view(state, driver, 'DRIVER', clock()), alreadyApplied: true } };
        }
        const policy = businessPolicy(state, clock()), operating = operatingPolicy(driver, state);
        if (!policy.allowed) throw error(409, policy.code, policy.message);
        if (!operating.allowed) throw error(409, operating.code, operating.message);
        const currentCode = codePolicy(state, clock());
        if (!currentCode.allowed) throw error(currentCode.code === 'PICKUP_CODE_RATE_LIMITED' ? 429 : 409, currentCode.code, currentCode.message);
        if (!await bcrypt.compare(secretInput(id, input.pickupCode), d.PickupCodeHash)) {
          if (await repository.failedAttempt(d, tx) !== 1) throw error(409, 'PICKUP_CONFLICT', 'Chuyến đã thay đổi. Vui lòng tải lại.');
          // Trả lỗi SAU khi transaction commit, để không rollback luôn bộ đếm.
          return { failure: Number(d.PickupCodeAttempts) + 1 >= MAX_ATTEMPTS
            ? error(429, 'PICKUP_CODE_RATE_LIMITED', 'Đã vượt giới hạn thử mã. Hãy nhờ người bán cấp lại mã khi hết thời gian chờ.') : invalidCode() };
        }
        const now = secondsDate(clock());
        if (time(d.PickupCodeExpiresAt) <= now.getTime()) return { failure: invalidCode() };
        if (file) saved = await storage.save(file.buffer, extension);
        const changes = { Status: 'PICKED_UP', PickedUpAt: now, PickupCodeUsedAt: now, PickupProofKey: saved?.key || null, PickupProofDigest: digest };
        if (await repository.pickedUp(d, changes, tx) !== 1) throw error(409, 'PICKUP_CONFLICT', 'Chuyến đã thay đổi. Vui lòng tải lại.');
        await repository.history({ OrderId: state.order.OrderId, DeliveryId: id, StatusType: 'DELIVERY', StatusValue: 'PICKED_UP', ChangedBy: userId,
          CreatedAt: now, Note: 'Tài xế đối chiếu mã và xác nhận đúng kiện, kiện còn nguyên vẹn.' }, tx);
        for (const recipient of new Set([state.order.BuyerId, state.order.SellerId, userId])) await repository.notifyUser(recipient, {
          type: 'DELIVERY', title: 'Tài xế đã lấy hàng', message: `Chuyến #${id}: đã nhận kiện; chuyến chuyển sang PICKED_UP. Chưa xác nhận giao thành công.`,
          referenceType: 'ORDER', referenceId: state.order.OrderId, createdAt: now }, tx);
        state.delivery = { ...d, ...changes };
        // Orders vẫn PAID, profile vẫn BUSY. D09/D13 xử lý các bước sau.
        return { message: 'Đã nhận kiện; chuyến chuyển sang PICKED_UP.', data: { ...view(state, driver, 'DRIVER', now), alreadyApplied: false } };
      });
      if (result.failure) throw result.failure;
      return result;
    } catch (e) {
      if (saved) {
        // Commit có thể thành công dù kết nối trả lỗi: không xóa ảnh đã được DB gắn.
        try { if (!await repository.proofIsReferenced(saved.key)) await storage.remove(saved); }
        catch { console.error('D08: chưa xác minh được file sau lỗi transaction; giữ file để tránh mất bằng chứng đã commit.'); }
      }
      throw e;
    }
  }
  async function getProof(orderId, deliveryId, user) {
    const oid = v.id(orderId), did = v.id(deliveryId), userId = identity(user);
    return run(async tx => {
      const state = await stateFor(oid, did, tx), d = state.delivery;
      await activeActor(userId, tx, false);
      if (userId !== Number(state.order.BuyerId) && userId !== Number(state.order.SellerId)) {
        if (userId !== Number(d.DriverId)) throw error(403, 'DELIVERY_FORBIDDEN', 'Bạn không có quyền xem bằng chứng của chuyến này.');
        await driverState(userId, tx, false);
      }
      if (!d.PickupProofKey || !d.PickedUpAt) throw error(404, 'PICKUP_PROOF_NOT_FOUND', 'Chưa có ảnh bằng chứng lấy hàng.');
      return storage.resolve(d.PickupProofKey);
    }, true);
  }
  return { getDriverPreview, getSellerPreview, issueCode, confirm, getProof };
}
module.exports = { ...createPickupService(), createPickupService, businessPolicy, codePolicy, handoverValid, CODE_TTL_SECONDS, RESEND_SECONDS, MAX_ATTEMPTS };
