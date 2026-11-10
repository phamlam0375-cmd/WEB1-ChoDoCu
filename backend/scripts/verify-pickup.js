'use strict';
const { createEnvironment } = require('../tests/helpers/d08-fixture');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { pngReceipt, jpgReceipt } = require('../tests/D03_ThanhToan/fixtures');
const repository = require('../src/repositories/D08_XacNhanLayHang/pickup.repository');
const storage = require('../src/services/D08_XacNhanLayHang/pickupProof.storage');
const { createPickupService } = require('../src/services/D08_XacNhanLayHang/pickup.service');
let environment, count = 0;
const check = async (name, work) => { await work(); console.log(`PASS D08 ${++count}: ${name}`); };
const codeOf = response => { assert.equal(response.status, 200, 'Cấp mã phải thành công'); assert.ok(typeof response.body.data.pickupCode === 'string', 'Thiếu mã một lần'); return response.body.data.pickupCode; };
const different = code => code === '000000' ? '000001' : '000000';
async function main() {
  const f = environment = await createEnvironment();
  const { sequelize, Users, UserRoles, DriverProfiles, StatusHistories, Notifications, RefundRequests } = f.models;
  const patch = (t, changes) => f.models.Deliveries.update(changes, { where: { DeliveryId: t.deliveryId } });
  const historyCount = t => StatusHistories.count({ where: { DeliveryId: t.deliveryId, StatusValue: 'PICKED_UP' } });
  const image = { buffer: pngReceipt(), type: 'image/png' };
  const t = await f.trip();
  await check('JWT thật: guest/header dev/demo/token hết hạn, thường và driver không được phân công bị chặn', async () => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: t.driver.UserId, exp: 1 })}`;
    const expired = input + '.' + crypto.createHmac('sha256', require('../src/utils/jwtSecret').getJwtSecret()).update(input).digest('base64url');
    for (const headers of [{}, { 'x-user-id': String(t.driver.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: `Bearer ${expired}` }]) {
      assert.equal((await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/pickup-preview`, { headers })).status, 401);
    }
    for (const user of [f.buyer, f.seller, f.outsider, await f.person(undefined, { driver: true })]) assert.equal((await f.pickup(t, '000000', { user })).status, 403);
    await Users.update({ Status: 'LOCKED' }, { where: { UserId: t.driver.UserId } });
    assert.equal((await f.pickup(t, '000000')).status, 403);
    await Users.update({ Status: 'ACTIVE' }, { where: { UserId: t.driver.UserId } });
    const grant = await UserRoles.findOne({ where: { UserId: t.driver.UserId } }); await grant.destroy();
    assert.equal((await f.pickup(t, '000000')).status, 403);
    await UserRoles.create({ UserId: t.driver.UserId, RoleId: grant.RoleId }); // Chỉ khôi phục fixture DB test.
  });
  await check('GET không sinh mã/bàn giao; quyền cấp mã chỉ đúng seller và không tự confirm kiện', async () => {
    const before = await f.read(t), notifications = await Notifications.count();
    for (let i = 0; i < 2; i++) {
      const a = await f.request(`/api/v1/seller/orders/${t.order.OrderId}/pickup-code`, { user: f.seller }); assert.equal(a.status, 200);
      const b = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/pickup-preview`, { user: t.driver }); assert.equal(b.status, 200); assert.equal(b.body.data.canConfirm, false);
      assert.ok(!JSON.stringify(a.body).includes('pickupCode"')); assert.ok(!JSON.stringify(b.body).includes('PickupCodeHash'));
    }
    assert.ok((await f.read(t)).PickupCodeHash === before.PickupCodeHash); assert.equal(await Notifications.count(), notifications);
    for (const user of [f.outsider, f.buyer, t.driver]) {
      assert.equal((await f.issue(t, user)).status, 403);
      assert.equal((await f.request(`/api/v1/seller/orders/${t.order.OrderId}/pickup-code`, { user })).status, 403);
    }
    assert.equal((await f.request(`/api/v1/seller/orders/${t.order.OrderId}/pickup-code`, { user: f.seller, method: 'POST', body: {} })).status, 400);
    assert.equal((await f.pickup(t, '000000')).status, 409);
  });
  const firstCode = codeOf(await f.issue(t));
  await check('Mã băm, hiệu lực/cooldown; không lộ mã trong GET/D05/history/notify', async () => {
    const d = await f.read(t); assert.ok(d.PickupCodeHash !== firstCode); assert.ok(await bcrypt.compare(`D08:${t.deliveryId}:${firstCode}`, d.PickupCodeHash));
    assert.equal((new Date(d.PickupCodeExpiresAt) - new Date(d.PickupCodeIssuedAt)) / 1000, 600);
    const retry = await f.issue(t); assert.equal(retry.status, 429); assert.ok(Number(retry.headers.get('retry-after')) > 0);
    const preview = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/pickup-preview`, { user: t.driver }); assert.equal(preview.body.data.canConfirm, true);
    for (const user of [f.buyer, f.seller, t.driver]) {
      const response = await f.request(`/api/v1/orders/${t.order.OrderId}/tracking`, { user }); assert.equal(response.status, 200);
      assert.ok(!JSON.stringify(response.body).includes(firstCode), 'D05 không được trả mã rõ'); assert.ok(!JSON.stringify(response.body).includes('PickupCodeHash'));
    }
    const records = JSON.stringify([await StatusHistories.findAll({ where: { DeliveryId: t.deliveryId } }), await Notifications.findAll({ where: { ReferenceId: t.order.OrderId } })]);
    assert.ok(!records.includes(firstCode), 'History/notify không chứa mã');
  });
  await check('Thử sai được commit và khóa sau 5 lần; không rollback bộ đếm theo lỗi HTTP', async () => {
    for (let n = 1; n <= 5; n++) { const response = await f.pickup(t, different(firstCode)); assert.equal(response.status, n === 5 ? 429 : 422); assert.equal((await f.read(t)).PickupCodeAttempts, n); }
    assert.equal((await f.pickup(t, firstCode)).status, 429); assert.equal((await f.read(t)).Status, 'ACCEPTED');
    await patch(t, { PickupCodeIssuedAt: new Date(Date.now() - 61000) });
    const regenerated = codeOf(await f.issue(t)); assert.equal((await f.read(t)).PickupCodeAttempts, 0);
    assert.equal((await f.pickup(t, different(regenerated), { body: { pickupCode: regenerated, packageIntact: false } })).status, 400);
  });
  await check('Cấp lại làm mã cũ mất hiệu lực, mã hết hạn và mã chuyến khác bị chặn', async () => {
    const a = await f.trip(), b = await f.trip(); const old = codeOf(await f.issue(a)); const other = codeOf(await f.issue(b));
    await patch(a, { PickupCodeIssuedAt: new Date(Date.now() - 61000) }); const fresh = codeOf(await f.issue(a));
    assert.ok(fresh !== old, 'Mã cấp lại phải khác mã cũ');
    assert.equal((await f.pickup(a, old)).status, 422);
    if (fresh !== other) assert.equal((await f.pickup(a, other)).status, 422);
    await patch(a, { PickupCodeExpiresAt: new Date(Date.now() - 1000) }); assert.equal((await f.pickup(a, fresh)).status, 409);
    assert.equal(await historyCount(a), 0);
  });
  await check('BUSY được tiếp tục; mã bắt đầu 0, không ảnh, đúng trạng thái/time/history và D05 actor', async () => {
    const a = await f.trip(); codeOf(await f.issue(a)); const leading = '000042';
    await patch(a, { PickupCodeHash: await bcrypt.hash(`D08:${a.deliveryId}:${leading}`, 10) }); // Fixture dẫn đầu 0, không phải mã cố định runtime.
    const response = await f.pickup(a, leading); assert.equal(response.status, 200); assert.equal(response.body.data.deliveryStatus, 'PICKED_UP');
    const d = await f.read(a); assert.equal(d.Status, 'PICKED_UP'); assert.ok(d.PickedUpAt && d.PickupCodeUsedAt); assert.equal(d.PickupProofKey, null);
    assert.equal((await a.order.reload()).Status, 'PAID'); assert.equal(d.DeliveredAt, null); assert.equal(d.VerifiedAt, null);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: a.driver.UserId } })).AvailabilityStatus, 'BUSY');
    assert.equal(await historyCount(a), 1);
    const tracking = await f.request(`/api/v1/orders/${a.order.OrderId}/tracking`, { user: a.driver });
    assert.equal(tracking.status, 200); const event = tracking.body.data.histories.find(h => h.status === 'PICKED_UP'); assert.equal(event.actor.userId, a.driver.UserId);
    assert.equal((await f.issue(a)).status, 409);
  });
  await check('Ảnh tùy chọn; PNG/JPG thật, file giả/quá 5MB, URL/ID/status client', async () => {
    const a = await f.trip(), code = codeOf(await f.issue(a));
    for (const body of [{ pickupCode: code, packageIntact: 'true' }, { pickupCode: code, packageIntact: true, proofUrl: '/foreign.png' },
      { pickupCode: code, packageIntact: true, DriverId: f.outsider.UserId }, { pickupCode: code, packageIntact: true, Status: 'DELIVERED' }]) assert.equal((await f.pickup(a, code, { body })).status, 400);
    assert.equal((await f.pickup(a, code, { file: { buffer: Buffer.from('fake PNG'), type: 'image/png' } })).status, 400);
    assert.equal((await f.pickup(a, code, { file: { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), type: 'image/png' } })).status, 413);
    assert.equal((await f.pickup(a, code, { file: image })).status, 200);
    const b = await f.trip(), jpgCode = codeOf(await f.issue(b));
    assert.equal((await f.pickup(b, jpgCode, { file: { buffer: jpgReceipt(), type: 'image/jpeg', name: 'fixture.jpg' } })).status, 200);
    const d = await f.read(a);
    for (const user of [f.buyer, f.seller, a.driver]) assert.equal((await f.request(`/api/v1/orders/${a.order.OrderId}/deliveries/${a.deliveryId}/pickup-proof`, { user, raw: true })).status, 200);
    assert.equal((await f.request(`/api/v1/orders/${a.order.OrderId}/deliveries/${a.deliveryId}/pickup-proof`, { user: f.outsider })).status, 403);
    assert.equal((await f.request(`/api/v1/orders/${a.order.OrderId}/deliveries/${a.deliveryId}/pickup-proof`)).status, 401);
    const ns = require('node:path').basename(storage.directory);
    assert.equal((await f.request(`/api/v1/uploads/.d08/${ns}/${d.PickupProofKey}`, { raw: true })).status, 404);
    assert.equal((await f.request(`/api/v1/uploads/%2ed08/${ns}/${d.PickupProofKey}`, { raw: true })).status, 404);
  });
  await check('Hai request nhận kiện + retry: một transition, không đổi ảnh/time/notify hoặc lùi trạng thái', async () => {
    const a = await f.trip(), code = codeOf(await f.issue(a)), before = await Notifications.count();
    const responses = await Promise.all([f.pickup(a, code, { file: image }), f.pickup(a, code, { file: image })]);
    assert.ok(responses.every(r => r.status === 200)); assert.equal(responses.filter(r => r.body.data.alreadyApplied).length, 1);
    const d = await f.read(a); assert.equal(await historyCount(a), 1); assert.equal(await Notifications.count(), before + 3);
    assert.equal((await f.pickup(a, code, { file: image })).status, 200);
    assert.ok((await f.read(a)).PickupProofKey === d.PickupProofKey); assert.equal(new Date((await f.read(a)).PickedUpAt).getTime(), new Date(d.PickedUpAt).getTime());
    assert.equal((await f.pickup(a, code)).status, 409);
    await patch(a, { Status: 'DELIVERING' });
    const retried = await f.pickup(a, code, { file: image }); assert.equal(retried.status, 200); assert.equal(retried.body.data.deliveryStatus, 'DELIVERING');
    await sequelize.query('UPDATE Deliveries SET ProofUrl = :url WHERE DeliveryId = :id', { replacements: { url: '/d13-future-proof.png', id: a.deliveryId } });
    const after = await f.read(a); assert.ok(after.PickupProofKey === d.PickupProofKey); assert.equal(after.ProofUrl, '/d13-future-proof.png');
  });
  await check('Rollback DB + file nếu history/notify thất bại, không xóa ảnh đã commit khi phản hồi lỗi', async () => {
    const a = await f.trip(), code = codeOf(await f.issue(a));
    const service = createPickupService({ repository: { ...repository, notifyUser: async () => { throw new Error('D08 injected rollback'); } } });
    const before = await fs.readdir(storage.directory).catch(() => []);
    await assert.rejects(service.confirm(a.deliveryId, { pickupCode: code, packageIntact: true }, { buffer: image.buffer }, { UserId: a.driver.UserId }), /injected rollback/);
    const d = await f.read(a); assert.equal(d.Status, 'ACCEPTED'); assert.equal(d.PickupProofKey, null); assert.equal(await historyCount(a), 0);
    assert.equal((await fs.readdir(storage.directory)).length, before.length);
    const uncertain = createPickupService({ repository: { ...repository, withTransaction: async work => { await repository.withTransaction(work); throw new Error('D08 injected response lost after commit'); } } });
    await assert.rejects(uncertain.confirm(a.deliveryId, { pickupCode: code, packageIntact: true }, { buffer: image.buffer }, { UserId: a.driver.UserId }), /response lost/);
    const saved = await f.read(a); assert.equal(saved.Status, 'PICKED_UP'); await fs.access(storage.resolve(saved.PickupProofKey).target);
  });
  await check('Cấp lại đồng thời dùng mã cũ: mutex MySQL không cho cả hai cùng thành công', async () => {
    const a = await f.trip(), code = codeOf(await f.issue(a)); await patch(a, { PickupCodeIssuedAt: new Date(Date.now() - 61000) });
    const [issued, picked] = await Promise.all([f.issue(a), f.pickup(a, code)]);
    assert.ok(!(issued.status === 200 && picked.status === 200), 'Không được cùng cấp lại và sử dụng mã cũ');
    assert.ok(issued.status === 200 || picked.status === 200); assert.ok([200, 409, 422].includes(picked.status));
  });
  await check('PICKUP/chưa nhận/hủy/hoàn tiền/payment/C07/profile sai đều chặn cả cấp mã và lấy hàng', async () => {
    for (const variant of ['PICKUP', 'AVAILABLE', 'CANCELLED', 'REFUND_PENDING', 'PAYMENT', 'PREPARATION', 'OFFLINE']) {
      const a = await f.trip(), code = codeOf(await f.issue(a)); await patch(a, { PickupCodeIssuedAt: new Date(Date.now() - 61000) });
      if (variant === 'PICKUP') await a.order.update({ DeliveryMethod: 'PICKUP' });
      else if (['CANCELLED', 'REFUND_PENDING'].includes(variant)) await a.order.update({ Status: variant });
      else if (variant === 'AVAILABLE') await patch(a, { Status: 'AVAILABLE' });
      else if (variant === 'PAYMENT') await a.payment.update({ Status: 'REPORTED' });
      else if (variant === 'PREPARATION') await patch(a, { PreparedBy: f.buyer.UserId });
      else await DriverProfiles.update({ AvailabilityStatus: 'OFFLINE' }, { where: { UserId: a.driver.UserId } });
      assert.equal((await f.pickup(a, code)).status, 409); assert.equal((await f.issue(a)).status, 409);
    }
    const a = await f.trip(), code = codeOf(await f.issue(a)); await RefundRequests.create({ OrderId: a.order.OrderId, RequestedBy: f.buyer.UserId, Reason: 'Fixture', Amount: '100000', Status: 'PENDING' });
    assert.equal((await f.pickup(a, code)).status, 409);
  });
  await check('Lấy hàng đồng thời B06/D02: serialize ORDER, không CANCELLED + PICKED_UP', async () => {
    const a = await f.trip(), code = codeOf(await f.issue(a));
    const [picked, refund] = await Promise.all([f.pickup(a, code), f.request(`/api/v1/orders/${a.order.OrderId}/refund-requests`, {
      user: f.buyer, method: 'POST', body: { reason: 'Không nhận được hàng', refundBankCode: '970418', refundAccountNumber: '1234567890', refundAccountHolder: 'TEST' } })]);
    assert.equal(refund.status, 201); assert.ok([200, 409].includes(picked.status)); assert.equal((await a.order.reload()).Status, 'REFUND_PENDING');
    assert.equal((await DriverProfiles.findOne({ where: { UserId: a.driver.UserId } })).AvailabilityStatus, 'BUSY');
    const b = await f.trip(), codeB = codeOf(await f.issue(b));
    const [pickup, cancel] = await Promise.all([f.pickup(b, codeB), f.request(`/api/v1/orders/${b.order.OrderId}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Không còn nhu cầu' } })]);
    assert.equal(pickup.status, 200); assert.equal(cancel.status, 409); assert.equal((await b.order.reload()).Status, 'PAID');
  });
  console.log(`PASS: ${count} nhóm D08 trên ${f.connection.db}; mã/token không ghi log, không SMTP, không reset DB local.`);
}
main().catch(e => { console.error('FAIL D08:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (environment) await environment.close(); });
