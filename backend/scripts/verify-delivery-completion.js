'use strict';
if (process.env.D13_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('D13 chỉ kiểm thử trên DB test local riêng đã guard UUID.');
process.env.AUTH_DEV_HEADER = 'false'; process.env.D01_DEMO_MODE = 'false';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
const { createCompletionService } = require('../src/services/D13_XacThucGiaoHangOTP/completion.service');
const repository = require('../src/repositories/D13_XacThucGiaoHangOTP/completion.repository');
const storage = require('../src/services/D13_XacThucGiaoHangOTP/completionProof.storage');
const { pngReceipt } = require('../tests/D03_ThanhToan/fixtures');
let f, count = 0;
const check = async (name, work) => { await work(); console.log(`PASS D13 ${++count}: ${name}`); };
async function main() {
  f = await createD13Environment();
  const { sequelize, Orders, Deliveries, StatusHistories, Notifications, DriverProfiles, Commissions, Users, UserRoles, PartnerApplications } = f.models;
  const raw = t => sequelize.query('SELECT * FROM Deliveries WHERE DeliveryId=:id', { replacements: { id: t.deliveryId }, type: require('sequelize').QueryTypes.SELECT }).then(rows => rows[0]);
  const update = (t, values) => Deliveries.update(values, { where: { DeliveryId: t.deliveryId }, logging: false });
  const received = t => f.request(`/api/v1/orders/${t.order.OrderId}/received`, { user: f.buyer, method: 'PATCH', body: { received: true } });
  const t = await f.ready(); let input;
  await check('JWT thật, đúng buyer/driver/ACTIVE/B02; GET không phát hành mã hoặc nhận demo header', async () => {
    for (const user of [undefined, f.seller, f.outsider, t.driver]) assert.equal((await f.request(`/api/v1/orders/${t.order.OrderId}/delivery-code`, { method: 'POST', body: {}, user })).status, user ? 403 : 401);
    assert.equal((await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/complete-preview`, { user: f.outsider })).status, 403);
    assert.equal((await f.request(`/api/v1/orders/${t.order.OrderId}/delivery-code`, { headers: { 'x-user-id': String(f.buyer.UserId), 'x-d01-demo': 'true' } })).status, 401);
    for (let i = 0; i < 2; i++) assert.equal((await f.request(`/api/v1/orders/${t.order.OrderId}/delivery-code`, { user: f.buyer })).status, 200);
    assert.equal((await raw(t)).CompletionCodeHash, null);
    await Users.update({ Status: 'LOCKED' }, { where: { UserId: t.driver.UserId } }); assert.equal((await f.issueDelivery(t)).status, 403); await Users.update({ Status: 'ACTIVE' }, { where: { UserId: t.driver.UserId } });
    await PartnerApplications.update({ Status: 'REJECTED' }, { where: { UserId: t.driver.UserId } }); assert.equal((await f.issueDelivery(t)).status, 403); await PartnerApplications.update({ Status: 'APPROVED' }, { where: { UserId: t.driver.UserId } });
    const role = await UserRoles.findOne({ where: { UserId: t.driver.UserId } }); await role.destroy(); assert.equal((await f.issueDelivery(t)).status, 403); await UserRoles.create({ UserId: t.driver.UserId, RoleId: role.RoleId });
  });
  await check('D01 → C05 → D03 → D04 → C07 → D07 → D08 → D09; issue private/cooldown; DB không lưu mã rõ', async () => {
    input = await f.intent(t); assert.match(input.completionCode, /^\d{6}$/); assert.notEqual(input.completionCode, t.pickupCode);
    const d = await raw(t); assert.ok(d.CompletionCodeHash.startsWith('$2')); assert.notEqual(d.CompletionCodeHash, input.completionCode);
    assert.equal(new Date(d.CompletionCodeExpiresAt) - new Date(d.CompletionCodeIssuedAt), 600000);
    assert.equal((await f.issueDelivery(t)).status, 429);
    const buyer = await f.request(`/api/v1/orders/${t.order.OrderId}/delivery-code`, { user: f.buyer }); assert.equal(buyer.body.data.completionCode, undefined); assert.equal(buyer.body.data.code.session, null); assert.match(buyer.headers.get('cache-control'), /no-store/);
    assert.equal((await received(t)).status, 409);
  });
  await check('Thiếu/sai ảnh hoặc checkbox không đốt lượt; chặn ảnh giả, quá lớn, body giả quyền', async () => {
    assert.equal((await f.submit(t, input, { file: undefined })).body.code, 'COMPLETION_PROOF_REQUIRED');
    assert.equal((await f.submit(t, { ...input, handoverConfirmed: false })).body.code, 'COMPLETION_PROOF_REQUIRED');
    assert.equal((await f.submit(t, { ...input, DriverId: t.driver.UserId })).status, 400);
    assert.equal((await f.submit(t, input, { file: { buffer: Buffer.from('fake') } })).body.code, 'INVALID_COMPLETION_PROOF');
    assert.equal((await f.submit(t, input, { file: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } })).status, 413);
    assert.equal((await raw(t)).CompletionCodeAttempts, 0);
  });
  await check('Mã sai/D08 sai mục đích; 5 request đồng thời commit đúng giới hạn và khóa, người lạ không đốt lượt', async () => {
    const wrong = { ...input, completionCode: t.pickupCode };
    assert.equal((await f.submit(t, wrong, { user: f.outsider })).status, 403);
    const results = await Promise.all(Array.from({ length: 5 }, () => f.submit(t, wrong)));
    assert.equal(results.filter(r => r.status === 422).length, 4); assert.equal(results.filter(r => r.status === 429).length, 1);
    assert.equal((await raw(t)).CompletionCodeAttempts, 5);
    assert.equal((await f.submit(t, input)).status, 429); assert.equal((await raw(t)).VerifiedAt, null);
  });
  await check('Tạo lại reset attempts, vô hiệu mã cũ/stale session không đốt mã mới; expiry phía server', async () => {
    await update(t, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) });
    const next = await f.intent(t); assert.notEqual(next.completionCode, input.completionCode);
    assert.equal((await f.submit(t, input)).body.code, 'COMPLETION_SESSION_CHANGED'); assert.equal((await raw(t)).CompletionCodeAttempts, 0);
    const expired = new Date(Date.now() - 1000); await update(t, { CompletionCodeExpiresAt: expired });
    assert.equal((await f.submit(t, next)).status, 422); assert.equal((await raw(t)).CompletionCodeAttempts, 0);
    await update(t, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) }); input = await f.intent(t);
  });
  await check('Rollback DB/lịch sử/thông báo và dọn file khi lỗi sau upload; leading0 dùng generator unit được inject', async () => {
    const before = await require('node:fs/promises').readdir(storage.directory).catch(() => []);
    const failure = createCompletionService({ repository: { ...repository, history: async () => { throw new Error('D13 rollback fixture'); } } });
    await assert.rejects(failure.complete(t.deliveryId, input, { buffer: pngReceipt(), size: pngReceipt().length, mimetype: 'image/png' }, randomUUID(), t.driver), /D13 rollback fixture/);
    assert.equal((await raw(t)).Status, 'DELIVERING'); assert.equal((await raw(t)).VerifiedAt, null);
    assert.equal((await Orders.findByPk(t.order.OrderId)).Status, 'IN_DELIVERY');
    const after = await require('node:fs/promises').readdir(storage.directory).catch(() => []); assert.deepEqual(after.sort(), before.sort());
    const u = await f.ready(); const generatorService = createCompletionService({ generateCode: () => '000017' });
    const code = await generatorService.issueCode(u.order.OrderId, {}, f.buyer); assert.equal(code.data.completionCode, '000017');
    const p = await f.driverPreview(u); assert.equal((await f.submit(u, { completionCode: code.data.completionCode, codeSession: p.body.data.code.session, handoverConfirmed: true })).status, 200);
  });
  let key = randomUUID(), before, proofKey;
  await check('Hai complete cùng key chỉ 1 ảnh/hai history/hai notify; DELIVERED chưa COMPLETED, không thay tiền/phí/hoa hồng, giữ ảnh D08', async () => {
    before = await raw(t); const commissions = await Commissions.count(), notifications = await Notifications.count();
    const responses = await Promise.all([f.submit(t, input, { headers: { 'Idempotency-Key': key } }), f.submit(t, input, { headers: { 'Idempotency-Key': key } })]);
    for (const r of responses) assert.equal(r.status, 200, r.body.message);
    assert.equal(responses.filter(r => r.body.data.alreadyApplied).length, 1);
    const d = await raw(t); proofKey = d.CompletionProofKey; assert.equal(d.Status, 'DELIVERED'); assert.ok(d.VerifiedAt); assert.equal(+new Date(d.VerifiedAt), +new Date(d.DeliveredAt)); assert.equal(+new Date(d.VerifiedAt), +new Date(d.CompletionCodeUsedAt));
    for (const k of ['DriverId', 'DriverFee', 'PickupProofKey', 'PickupProofDigest', 'PickupCodeUsedAt']) assert.deepEqual(d[k], before[k]);
    const order = await Orders.findByPk(t.order.OrderId); assert.equal(order.Status, 'DELIVERED'); assert.equal(order.CompletedAt, null); assert.equal(String(order.ProductAmount), '100000.10'); assert.equal(String(order.DeliveryFee), '20000.20');
    assert.equal(await Commissions.count(), commissions); assert.equal(await Notifications.count(), notifications + 2);
    assert.equal(await StatusHistories.count({ where: { DeliveryId: t.deliveryId, StatusValue: 'DELIVERED' } }), 2);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: t.driver.UserId } })).AvailabilityStatus, 'OFFLINE');
    assert.equal((await f.submit(t, input)).status, 409);
  });
  await check('Private proof buyer/seller/assigned driver only; D05 không leak OTP/hash/key, D06 enabled', async () => {
    const url = `/api/v1/orders/${t.order.OrderId}/deliveries/${t.deliveryId}/completion-proof`;
    for (const user of [f.buyer, f.seller, t.driver]) { const r = await f.request(url, { user, raw: true }); assert.equal(r.status, 200); assert.deepEqual(r.body, pngReceipt()); }
    assert.equal((await f.request(url, { user: f.outsider })).status, 403); assert.equal((await f.request(url)).status, 401);
    const tracking = await f.request(`/api/v1/orders/${t.order.OrderId}/tracking`, { user: f.buyer }); assert.equal(tracking.status, 200); assert.equal(tracking.body.data.capabilities.receive.enabled, true);
    const text = JSON.stringify(tracking.body); for (const secret of [input.completionCode, input.codeSession, proofKey, (await raw(t)).CompletionCodeHash]) assert.equal(text.includes(secret), false);
    const d = await raw(t); await storage.remove({ key: proofKey });
    assert.equal((await received(t)).status, 409); // DB pointer without actual bytes is insufficient.
    const restored = await storage.save(pngReceipt(), 'png'); await update(t, { CompletionProofKey: restored.key });
    assert.equal(d.CompletionProofDigest, (await raw(t)).CompletionProofDigest);
  });
  await check('D06 chỉ sau D13, idempotent retry D13 sau COMPLETED không ghi lùi/hoa hồng lại', async () => {
    const commissions = await Commissions.count(); assert.equal((await received(t)).status, 200); assert.equal((await Orders.findByPk(t.order.OrderId)).Status, 'COMPLETED');
    assert.equal(await Commissions.count(), commissions + 1);
    const completedAt = (await Orders.findByPk(t.order.OrderId)).CompletedAt;
    const replay = await f.submit(t, {}, { file: undefined, headers: { 'Idempotency-Key': key } }); assert.equal(replay.status, 200, replay.body.message); assert.equal(replay.body.data.orderStatus, 'COMPLETED');
    assert.equal((await f.submit(t, { ...input, completionCode: t.pickupCode }, { headers: { 'Idempotency-Key': key } })).status, 409);
    assert.equal((await received(t)).status, 200); assert.deepEqual((await Orders.findByPk(t.order.OrderId)).CompletedAt, completedAt); assert.equal(await Commissions.count(), commissions + 1);
  });
  await check('D10 FAILED → RETRY thu hồi mã; mã cũ không sống lại, mã mới vẫn hoạt động', async () => {
    const u = await f.ready(), old = await f.intent(u);
    const action = async body => { const p = await f.request(`/api/v1/driver/deliveries/${u.deliveryId}/failure-preview`, { user: u.driver }); return f.request(`/api/v1/driver/deliveries/${u.deliveryId}/failure`, { user: u.driver, method: 'PATCH', body, headers: { 'Idempotency-Key': randomUUID(), 'If-Match': p.body.data.version } }); };
    assert.equal((await action({ action: 'FAIL', reasonCode: 'UNAVAILABLE', note: 'Test receiver unavailable' })).status, 200);
    assert.equal((await raw(u)).CompletionCodeExpiresAt, null); assert.equal((await f.submit(u, old)).status, 409);
    assert.equal((await action({ action: 'SCHEDULE', scheduledAt: new Date(Date.now() + 60000).toISOString() })).status, 200);
    await update(u, { RetryScheduledAt: new Date(Date.now() - 1000) }); // Fixture thời gian đến lịch, không đổi quy tắc D10.
    assert.equal((await action({ action: 'RETRY', note: 'Test retry' })).status, 200);
    assert.equal((await f.submit(u, old)).status, 422);
    await update(u, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) }); const next = await f.intent(u); assert.notEqual(next.completionCode, old.completionCode);
    assert.equal((await f.submit(u, next)).status, 200);
  });
  await check('Resend chống spam giới hạn 5 lần/giờ; reset window không tạo lại mã bằng GET', async () => {
    const u = await f.ready();
    for (let i = 0; i < 5; i++) { if (i) await update(u, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) }); assert.equal((await f.issueDelivery(u)).status, 200); }
    await update(u, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) }); const limited = await f.issueDelivery(u); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 60);
    await update(u, { CompletionIssueWindowAt: new Date(Date.now() - 3601000) }); assert.equal((await f.issueDelivery(u)).status, 200); assert.equal((await raw(u)).CompletionIssueCount, 1);
  });
  await check('Chưa D09 và tin pickup không cho issue; fresh service restart giữ được OTP/counter trong DB', async () => {
    const u = await f.ready({ start: false }); assert.equal((await f.issueDelivery(u)).status, 409);
    const product = await f.listing(), pickup = await f.request('/api/v1/orders', { user: f.buyer, method: 'POST', body: { listingId: product.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Buyer', receiverPhone: '0900000111' } });
    assert.equal(pickup.status, 201); assert.equal((await f.issueDelivery({ order: { OrderId: pickup.body.data.orderId } })).status, 409);
    const next = await f.ready(), body = await f.intent(next); const first = createCompletionService();
    await assert.rejects(first.complete(next.deliveryId, { ...body, completionCode: next.pickupCode }, { buffer: pngReceipt(), size: pngReceipt().length }, randomUUID(), next.driver), { status: 422 });
    const restarted = createCompletionService(); assert.equal((await restarted.getDriverPreview(next.deliveryId, next.driver)).code.attemptsRemaining, 4);
    assert.equal((await restarted.complete(next.deliveryId, body, { buffer: pngReceipt(), size: pngReceipt().length }, randomUUID(), next.driver)).data.verified, true);
  });
  await check('Race complete với resend: một bên thắng, phiên cũ không thể giao sau khi mã đã đổi', async () => {
    const u = await f.ready(), old = await f.intent(u); await update(u, { CompletionCodeIssuedAt: new Date(Date.now() - 61000) });
    const [issued, completed] = await Promise.all([f.issueDelivery(u), f.submit(u, old)]);
    assert.equal([issued, completed].filter(r => r.status === 200).length, 1);
    if (issued.status === 200) { assert.equal(completed.status, 409); assert.equal((await raw(u)).Status, 'DELIVERING'); assert.equal((await f.submit(u, old)).status, 409); }
    else { assert.equal(issued.status, 409); assert.equal((await raw(u)).Status, 'DELIVERED'); }
  });
  await check('Race complete với D10 FAIL và D06: không ghi đè FAILED hoặc COMPLETED', async () => {
    const u = await f.ready(), body = await f.intent(u), preview = await f.request(`/api/v1/driver/deliveries/${u.deliveryId}/failure-preview`, { user: u.driver });
    const [failure, completed] = await Promise.all([
      f.request(`/api/v1/driver/deliveries/${u.deliveryId}/failure`, { user: u.driver, method: 'PATCH', body: { action: 'FAIL', reasonCode: 'UNAVAILABLE' }, headers: { 'Idempotency-Key': randomUUID(), 'If-Match': preview.body.data.version } }),
      f.submit(u, body),
    ]);
    assert.equal([failure, completed].filter(r => r.status === 200).length, 1); assert.ok([failure, completed].some(r => r.status === 409));
    assert.equal((await raw(u)).Status, failure.status === 200 ? 'FAILED' : 'DELIVERED');
    const v = await f.ready(), valid = await f.intent(v), requestId = randomUUID();
    const [delivery, receipt] = await Promise.all([f.submit(v, valid, { headers: { 'Idempotency-Key': requestId } }), received(v)]);
    assert.equal(delivery.status, 200); assert.ok([200, 409].includes(receipt.status));
    if (receipt.status === 409) assert.equal((await received(v)).status, 200);
    assert.equal((await f.submit(v, {}, { file: undefined, headers: { 'Idempotency-Key': requestId } })).body.data.orderStatus, 'COMPLETED');
    assert.equal(await StatusHistories.count({ where: { DeliveryId: v.deliveryId, StatusType: 'DELIVERY', StatusValue: 'DELIVERED' } }), 1);
  });
  await check('Hai key hoàn tất khác nhau không ghi trùng; driver giữ BUSY nếu còn assignment khác', async () => {
    const older = await f.trip({ accept: false }), u = await f.ready(), body = await f.intent(u);
    // Dữ liệu legacy nhiều assignment: không giả AVAILABLE để D07 nhận thêm chuyến.
    await Deliveries.update({ DriverId: u.driver.UserId, Status: 'ACCEPTED' }, { where: { DeliveryId: older.deliveryId } });
    const results = await Promise.all([f.submit(u, body), f.submit(u, body)]);
    assert.equal(results.filter(r => r.status === 200).length, 1); assert.equal(results.filter(r => r.status === 409).length, 1);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: u.driver.UserId } })).AvailabilityStatus, 'BUSY');
    assert.equal((await raw(u)).DriverId, u.driver.UserId);
  });
  await check('Commit đã thành công nhưng mất ACK giữ ảnh đang tham chiếu; retry xác minh kết quả không tái dùng OTP', async () => {
    const u = await f.ready(), body = await f.intent(u), requestId = randomUUID();
    const service = createCompletionService({ repository: { ...repository, withTransaction: async work => { await repository.withTransaction(work); throw new Error('D13 commit ACK fixture'); } } });
    await assert.rejects(service.complete(u.deliveryId, body, { buffer: pngReceipt(), size: pngReceipt().length }, requestId, u.driver), /D13 commit ACK fixture/);
    const saved = await raw(u); assert.equal(saved.Status, 'DELIVERED'); assert.equal(await storage.valid(saved.CompletionProofKey, saved.CompletionProofDigest), true);
    const retry = await f.submit(u, {}, { file: undefined, headers: { 'Idempotency-Key': requestId } }); assert.equal(retry.status, 200); assert.equal(retry.body.data.alreadyApplied, true);
    assert.equal((await raw(u)).CompletionProofKey, saved.CompletionProofKey);
    const notifications = await Notifications.findAll({ where: { ReferenceType: 'ORDER', ReferenceId: u.order.OrderId }, raw: true });
    const histories = await StatusHistories.unscoped().findAll({ where: { OrderId: u.order.OrderId }, raw: true });
    for (const row of [...notifications, ...histories]) { assert.equal(JSON.stringify(row).includes(body.completionCode), false); assert.equal(JSON.stringify(row).includes(saved.CompletionCodeHash), false); }
  });
  console.log(`D13 MySQL local isolated: ${count} checks passed; no CD/group fixtures.`);
}
main().catch(e => { console.error('D13 verification failed:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
