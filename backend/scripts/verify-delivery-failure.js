'use strict';
if (process.env.D10_INTEGRATION_TEST !== 'true') throw new Error('Chỉ chạy D10 với database test riêng đã xác minh.');
process.env.AUTH_DEV_HEADER = 'true'; process.env.D01_DEMO_MODE = 'true'; // Chỉ tiến trình test: D10 vẫn phải yêu cầu JWT.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createEnvironment } = require('../tests/helpers/d08-fixture');
const { createFailureService } = require('../src/services/D10_ThatBai_HoanTra/failure.service');
const repository = require('../src/repositories/D10_ThatBai_HoanTra/failure.repository');
const { pngReceipt } = require('../tests/D03_ThanhToan/fixtures');
let environment, count = 0;
const check = async (name, work) => { await work(); console.log(`PASS D10 ${++count}: ${name}`); };
async function main() {
  const f = environment = await createEnvironment();
  const { sequelize, Deliveries, Orders, Payments, DriverProfiles, Users, UserRoles, PartnerApplications, StatusHistories, Notifications, RefundRequests, Commissions, Listings } = f.models;
  const preview = async t => { const r = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/failure-preview`, { user: t.driver }); assert.equal(r.status, 200); return r.body.data; };
  const events = t => StatusHistories.findAll({ where: { DeliveryId: t.deliveryId, StatusType: 'DELIVERY' }, attributes: ['HistoryId', 'StatusValue', 'Note', 'ChangedBy', 'CreatedAt', 'D10Event'], order: [['HistoryId', 'ASC']], raw: true });
  const call = (t, action, body = {}, { version, key = randomUUID(), user = t.driver, headers = {} } = {}) => f.request(`/api/v1/driver/deliveries/${t.deliveryId}/${['START_RETURN', 'CONFIRM_RETURN'].includes(action) ? 'return' : 'failure'}`, {
    user, method: 'PATCH', body: { action, ...body }, headers: { 'Idempotency-Key': key, 'If-Match': version, ...headers } });
  const act = async (t, action, body = {}) => call(t, action, body, { version: (await preview(t)).version });
  const fail = t => act(t, 'FAIL', { reasonCode: 'UNAVAILABLE', note: 'Đã liên hệ nhưng chưa giao được' });
  async function trip({ image = false } = {}) {
    const t = await f.trip(), issued = await f.issue(t); assert.equal(issued.status, 200, 'D08 seller cấp mã');
    assert.equal((await f.pickup(t, issued.body.data.pickupCode, image ? { file: { buffer: pngReceipt(), type: 'image/png' } } : {})).status, 200, 'D08 xác nhận lấy hàng');
    t.startKey = randomUUID();
    const started = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/status`, { user: t.driver, method: 'PATCH', headers: { 'Idempotency-Key': t.startKey }, body: { status: 'DELIVERING', action: 'START', note: 'Bắt đầu giao fixture D10' } });
    assert.equal(started.status, 200, 'Phải bắt đầu qua D09'); return t;
  }
  const t = await trip({ image: true });
  await check('JWT/fresh C01-B02 và đúng phân công; guest, dev/demo, buyer/seller/driver khác bị chặn', async () => {
    const version = (await preview(t)).version;
    for (const headers of [{}, { 'x-user-id': String(t.driver.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }]) assert.equal((await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/failure`, { method: 'PATCH', headers, body: { action: 'FAIL' } })).status, 401);
    for (const user of [f.buyer, f.seller, f.outsider, await f.person(undefined, { driver: true })]) assert.equal((await call(t, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version, user })).status, 403);
    await Users.update({ Status: 'LOCKED' }, { where: { UserId: t.driver.UserId } }); assert.equal((await call(t, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version })).status, 403);
    await Users.update({ Status: 'ACTIVE' }, { where: { UserId: t.driver.UserId } });
    const grant = await UserRoles.findOne({ where: { UserId: t.driver.UserId } }); await grant.destroy(); assert.equal((await call(t, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version })).status, 403);
    await UserRoles.create({ UserId: t.driver.UserId, RoleId: grant.RoleId });
    await PartnerApplications.update({ Status: 'PENDING' }, { where: { UserId: t.driver.UserId, PartnerType: 'DRIVER' } }); assert.equal((await call(t, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version })).status, 403);
    await PartnerApplications.update({ Status: 'APPROVED' }, { where: { UserId: t.driver.UserId, PartnerType: 'DRIVER' } });
  });
  await check('Validation reason/Other, calendar/timezone, payload whitelist và không vượt D13', async () => {
    for (const body of [{ action: 'FAIL' }, { action: 'FAIL', reasonCode: 'OTHER' }, { action: 'FAIL', reasonCode: 'OTHER', note: 'x'.repeat(501) },
      ...['DriverId', 'UserId', 'RetryCount', 'ReturnedAt', 'VerifiedAt', 'ProofUrl', 'status'].map(k => ({ action: 'FAIL', reasonCode: 'UNAVAILABLE', [k]: k === 'status' ? 'DELIVERED' : 1 }))]) assert.equal((await call(t, body.action, body, { version: (await preview(t)).version })).status, 400);
    assert.equal((await call(t, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version: (await preview(t)).version, key: t.startKey })).status, 409, 'Không dùng lại khóa D09 làm D10');
    assert.equal((await act(t, 'SCHEDULE', { scheduledAt: '2026-02-30T06:00:00Z' })).status, 400);
    assert.equal((await act(t, 'SCHEDULE', { scheduledAt: '2026-11-06T13:00' })).status, 400);
    assert.equal((await act(t, 'CONFIRM_RETURN', { recipientName: 'Seller', handoverConfirmed: 'true' })).status, 400);
  });
  const original = await f.read(t), key = randomUUID(), before = await preview(t), refunds = await RefundRequests.count(), commissions = await Commissions.count();
  const failureBody = { reasonCode: 'UNAVAILABLE', note: 'Không liên hệ được ở lần đầu' };
  await check('D07-D08-D09 thật -> FAILED: đúng lịch sử/người/thời điểm, giữ ảnh/tiền/profile và không tạo refund', async () => {
    const r = await call(t, 'FAIL', failureBody, { key, version: before.version }); assert.equal(r.status, 200); assert.equal(r.body.data.deliveryStatus, 'FAILED'); assert.equal(r.body.data.failureCount, 1); assert.equal(r.body.data.retryCount, 0);
    const d = await f.read(t); assert.equal(d.ReturnedAt, null); assert.equal((await t.order.reload()).Status, 'IN_DELIVERY');
    for (const field of ['PickupProofKey', 'PickupProofDigest', 'PickupCodeHash', 'ProofUrl', 'CompletionCodeHash', 'DeliveredAt', 'VerifiedAt']) assert.ok(d[field] === original[field], `Không thay đổi ${field}`);
    assert.equal(new Date(d.PickedUpAt).getTime(), new Date(original.PickedUpAt).getTime());
    assert.equal(await RefundRequests.count(), refunds); assert.equal(await Commissions.count(), commissions); assert.equal((await t.payment.reload()).Status, 'CONFIRMED');
    const e = (await events(t)).find(e => e.StatusValue === 'FAILED'); assert.equal(e.ChangedBy, t.driver.UserId); assert.equal(e.D10Event.attempt, 1); assert.ok(e.Note.includes(failureBody.note));
    assert.equal((await DriverProfiles.findOne({ where: { UserId: t.driver.UserId } })).AvailabilityStatus, 'BUSY');
  });
  await check('Retry cùng request không thêm counter/history/notify; version cũ không ghi thất bại lần nữa', async () => {
    const n = await Notifications.count(), e = (await events(t)).length;
    const r = await call(t, 'FAIL', failureBody, { key, version: before.version }); assert.equal(r.status, 200); assert.equal(r.body.data.alreadyApplied, true);
    assert.equal((await call(t, 'FAIL', failureBody, { version: before.version })).status, 409);
    assert.equal((await call(t, 'FAIL', { ...failureBody, note: 'khác' }, { key, version: before.version })).status, 409);
    assert.equal(await Notifications.count(), n); assert.equal((await events(t)).length, e);
    assert.equal((await act(t, 'CONFIRM_RETURN', { recipientName: 'Seller', handoverConfirmed: true })).status, 409, 'Không nhảy FAILED -> RETURNED');
  });
  await check('Lịch bền vững và timezone; không tăng RetryCount hoặc tự giao khi hẹn', async () => {
    assert.equal((await act(t, 'SCHEDULE', { scheduledAt: '2020-01-01T00:00:00Z' })).status, 400);
    const scheduleKey = randomUUID(), version = (await preview(t)).version, body = { scheduledAt: new Date(Date.now() + 1800).toISOString(), note: 'Đã hẹn người mua' };
    const r = await call(t, 'SCHEDULE', body, { key: scheduleKey, version }); assert.equal(r.status, 200);
    const persisted = await preview(t); assert.ok(persisted.scheduledAt); assert.equal(persisted.deliveryStatus, 'FAILED'); assert.equal(persisted.retryCount, 0); assert.equal(persisted.failureCount, 1);
    assert.equal((await act(t, 'RETRY')).status, 409);
    const delay = Math.max(0, new Date(persisted.scheduledAt).getTime() - Date.now() + 50); await new Promise(resolve => setTimeout(resolve, delay));
    assert.equal((await f.read(t)).Status, 'FAILED', 'Đến giờ vẫn chưa tự bắt đầu');
    assert.equal((await call(t, 'SCHEDULE', body, { key: scheduleKey, version })).body.data.alreadyApplied, true, 'Retry lịch đã qua vẫn chỉ đọc kết quả commit');
  });
  await check('Bắt đầu lần giao lại thật tăng đúng 1; thất bại mới mới được đếm, request cũ không kéo lùi', async () => {
    const v = (await preview(t)).version, k = randomUUID(); const r = await call(t, 'RETRY', {}, { key: k, version: v }); assert.equal(r.status, 200); assert.equal(r.body.data.retryCount, 1); assert.equal(r.body.data.failureCount, 1);
    assert.equal((await call(t, 'RETRY', {}, { key: k, version: v })).body.data.alreadyApplied, true);
    assert.equal((await call(t, 'FAIL', failureBody, { key, version: before.version })).body.data.deliveryStatus, 'DELIVERING');
    const version = (await preview(t)).version, responses = await Promise.all([call(t, 'FAIL', failureBody, { version }), call(t, 'FAIL', failureBody, { version })]);
    assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 1);
    assert.equal((await preview(t)).failureCount, 2); assert.equal((await preview(t)).retryCount, 1);
  });
  await check('REFUND_PENDING chặn giao lại, không làm mắc kẹt trả kiện; RETURNING chưa ReturnedAt', async () => {
    const refund = await f.request(`/api/v1/orders/${t.order.OrderId}/refund-requests`, { user: f.buyer, method: 'POST', body: { reason: 'Không nhận được hàng', refundBankCode: '970418', refundAccountNumber: '1234567890', refundAccountHolder: 'TEST' } });
    assert.equal(refund.status, 201); const requests = await RefundRequests.count();
    assert.equal((await act(t, 'SCHEDULE', { scheduledAt: '2099-01-01T00:00:00Z' })).status, 409);
    const r = await act(t, 'START_RETURN', { note: 'Ngừng giao, mang về người bán' }); assert.equal(r.status, 200); assert.equal(r.body.data.deliveryStatus, 'RETURNING'); assert.equal(r.body.data.returnedAt, null);
    assert.equal(await RefundRequests.count(), requests); assert.equal((await t.order.reload()).Status, 'REFUND_PENDING');
    assert.equal((await DriverProfiles.findOne({ where: { UserId: t.driver.UserId } })).AvailabilityStatus, 'BUSY');
    assert.equal((await act(t, 'RETRY')).status, 409);
  });
  await check('RETURNED là bàn giao vật lý, không hoàn tiền/mở bán; driver về OFFLINE an toàn, giữ DriverId', async () => {
    assert.equal((await act(t, 'CONFIRM_RETURN', { recipientName: 'Seller' })).status, 400);
    const body = { handoverConfirmed: true, recipientName: 'Người bán fixture', note: 'Đã bàn giao nguyên kiện' }, version = (await preview(t)).version, key = randomUUID(), requests = await RefundRequests.count();
    const r = await call(t, 'CONFIRM_RETURN', body, { key, version }); assert.equal(r.status, 200); assert.equal(r.body.data.deliveryStatus, 'RETURNED'); assert.ok(r.body.data.returnedAt);
    assert.equal((await call(t, 'CONFIRM_RETURN', body, { key, version })).body.data.alreadyApplied, true);
    const d = await f.read(t); assert.equal(d.DriverId, t.driver.UserId); assert.equal((await t.order.reload()).Status, 'REFUND_PENDING'); assert.equal((await t.payment.reload()).Status, 'CONFIRMED');
    assert.equal(await RefundRequests.count(), requests); assert.equal(await Commissions.count(), commissions); assert.equal((await Listings.findByPk(t.order.ListingId)).Status, 'RESERVED');
    assert.equal((await DriverProfiles.findOne({ where: { UserId: t.driver.UserId } })).AvailabilityStatus, 'OFFLINE');
    assert.ok(d.PickupProofKey === original.PickupProofKey); assert.ok(d.PickupCodeHash === original.PickupCodeHash);
    for (const user of [f.buyer, f.seller, t.driver]) {
      const tracking = await f.request(`/api/v1/orders/${t.order.OrderId}/tracking`, { user }); assert.equal(tracking.status, 200); assert.equal(tracking.body.data.progress.label, 'Đã trả hàng cho người bán');
      assert.equal(tracking.body.data.deliveries[0].failureCount, 2); assert.equal(tracking.body.data.deliveries[0].retryCount, 1);
      assert.ok(!JSON.stringify(tracking.body).includes('D09RequestHash')); assert.ok(!JSON.stringify(tracking.body).includes('PickupCodeHash'));
    }
  });
  await check('Chuyển hoàn chỉ nối B06 buyer; thanh toán không hợp lệ không tạo khoản hoàn giả', async () => {
    for (const paid of [true, false]) {
      const a = await trip(); if (!paid) await a.payment.update({ Status: 'REPORTED' });
      assert.equal((await fail(a)).status, 200); const requests = await RefundRequests.count(); assert.equal((await act(a, 'START_RETURN')).status, 200);
      const buyer = await f.request(`/api/v1/orders/${a.order.OrderId}/tracking`, { user: f.buyer });
      assert.equal(Boolean(buyer.body.data.deliveries[0].refundHandoff.href), paid); assert.equal(buyer.body.data.capabilities.refund.enabled, paid);
      assert.equal(await RefundRequests.count(), requests); assert.equal((await preview(a)).refund.href, null);
    }
  });
  await check('Rollback cả trạng thái/history/notify; response mất sau commit không xử lý lại', async () => {
    const a = await trip(), version = (await preview(a)).version, key = randomUUID(), body = { action: 'FAIL', reasonCode: 'UNAVAILABLE' };
    let sent = 0; const n = await Notifications.count(), e = (await events(a)).length;
    const failed = createFailureService({ repository: { ...repository, notifyUser: async (...args) => { if (++sent === 2) throw new Error('D10 injected rollback'); return repository.notifyUser(...args); } } });
    await assert.rejects(failed.update(a.deliveryId, body, key, version, 'failure', { UserId: a.driver.UserId }), /injected rollback/);
    assert.equal((await f.read(a)).Status, 'DELIVERING'); assert.equal((await events(a)).length, e); assert.equal(await Notifications.count(), n);
    const uncertain = createFailureService({ repository: { ...repository, withTransaction: async work => { await repository.withTransaction(work); throw new Error('D10 injected response lost'); } } });
    await assert.rejects(uncertain.update(a.deliveryId, body, key, version, 'failure', { UserId: a.driver.UserId }), /response lost/);
    assert.equal((await call(a, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { key, version })).body.data.alreadyApplied, true);
    assert.equal((await preview(a)).failureCount, 1); assert.equal((await events(a)).length, e + 1); assert.equal(await Notifications.count(), n + 3);
    const b = await trip(); await fail(b); await act(b, 'START_RETURN');
    const returnVersion = (await preview(b)).version, returnEvents = (await events(b)).length, returnNotifications = await Notifications.count(); sent = 0;
    await assert.rejects(failed.update(b.deliveryId, { action: 'CONFIRM_RETURN', recipientName: 'Seller', handoverConfirmed: true }, randomUUID(), returnVersion, 'return', { UserId: b.driver.UserId }), /injected rollback/);
    assert.equal((await f.read(b)).Status, 'RETURNING'); assert.equal((await f.read(b)).ReturnedAt, null);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: b.driver.UserId } })).AvailabilityStatus, 'BUSY');
    assert.equal((await events(b)).length, returnEvents); assert.equal(await Notifications.count(), returnNotifications);
  });
  await check('MySQL race giao lại/chuyển hoàn: một nhánh thắng, không cùng bắt đầu hai hướng', async () => {
    const duplicate = await trip(), key = randomUUID(), duplicateVersion = (await preview(duplicate)).version, notifications = await Notifications.count();
    const duplicateCalls = await Promise.all([call(duplicate, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { key, version: duplicateVersion }), call(duplicate, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { key, version: duplicateVersion })]);
    assert.ok(duplicateCalls.every(r => r.status === 200)); assert.equal(duplicateCalls.filter(r => r.body.data.alreadyApplied).length, 1);
    assert.equal((await preview(duplicate)).failureCount, 1); assert.equal(await Notifications.count(), notifications + 3);
    const a = await trip(); await fail(a); const r = await act(a, 'SCHEDULE', { scheduledAt: new Date(Date.now() + 1000).toISOString() }); assert.equal(r.status, 200);
    const p = await preview(a); await new Promise(resolve => setTimeout(resolve, Math.max(0, new Date(p.scheduledAt).getTime() - Date.now() + 50)));
    const responses = await Promise.all([call(a, 'RETRY', {}, { version: p.version }), call(a, 'START_RETURN', {}, { version: p.version })]);
    assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 1); assert.ok(['DELIVERING', 'RETURNING'].includes((await f.read(a)).Status));
  });
  await check('MySQL race failure/D13-contract CAS không ghi đè DELIVERED (D13 API chưa có)', async () => {
    const a = await trip(), version = (await preview(a)).version;
    // Chỉ mô phỏng mutex/CAS của bước D13 tương lai trong DB test, không tạo API giả
    // hoặc khẳng định đã kiểm tra OTP/ảnh giao thành công của D13.
    const completion = sequelize.transaction(async tx => {
      await Orders.findByPk(a.order.OrderId, { transaction: tx, lock: tx.LOCK.UPDATE });
      await Payments.findOne({ where: { OrderId: a.order.OrderId }, transaction: tx, lock: tx.LOCK.UPDATE });
      const d = await Deliveries.findByPk(a.deliveryId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (d.Status !== 'DELIVERING') return false;
      await d.update({ Status: 'DELIVERED' }, { transaction: tx }); await Orders.update({ Status: 'DELIVERED' }, { where: { OrderId: a.order.OrderId }, transaction: tx }); return true;
    });
    const [r, completed] = await Promise.all([call(a, 'FAIL', { reasonCode: 'UNAVAILABLE' }, { version }), completion]);
    assert.ok(!(r.status === 200 && completed)); assert.ok(r.status === 200 || completed); assert.equal((await f.read(a)).Status, completed ? 'DELIVERED' : 'FAILED');
  });
  await check('RETURNED không giải phóng nếu còn nhiệm vụ khác (fixture legacy riêng, không tự cấp chuyến thật)', async () => {
    const a = await trip(); await fail(a); await act(a, 'START_RETURN');
    const other = await f.trip({ driver: a.driver, accept: false });
    // Tình huống dữ liệu legacy nhiều nhiệm vụ; không đi qua lối tắt nào ở API production.
    await Deliveries.update({ DriverId: a.driver.UserId, Status: 'ACCEPTED' }, { where: { DeliveryId: other.deliveryId } });
    assert.equal((await act(a, 'CONFIRM_RETURN', { handoverConfirmed: true, recipientName: 'Seller' })).status, 200);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: a.driver.UserId } })).AvailabilityStatus, 'BUSY');
  });
  console.log(`PASS: ${count} nhóm D10 trên ${f.connection.db}; không reset DB nhóm, không CD/SMTP, không log mã/token.`);
}
main().catch(e => { console.error('FAIL D10:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (environment) await environment.close(); });
