'use strict';
if (process.env.D09_INTEGRATION_TEST !== 'true') throw new Error('Chỉ chạy D09 với database test riêng đã xác minh.');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createEnvironment } = require('../tests/helpers/d08-fixture');
const { createProgressService } = require('../src/services/D09_CapNhatTienDoGiaoHang/progress.service');
const repository = require('../src/repositories/D09_CapNhatTienDoGiaoHang/progress.repository');
const { pngReceipt } = require('../tests/D03_ThanhToan/fixtures');
let environment, count = 0;
const check = async (name, work) => { await work(); console.log(`PASS D09 ${++count}: ${name}`); };
async function main() {
  const f = environment = await createEnvironment();
  const { sequelize, Orders, Deliveries, Users, UserRoles, PartnerApplications, DriverProfiles, StatusHistories, Notifications, RefundRequests, Commissions } = f.models;
  const path = t => `/api/v1/driver/deliveries/${t.deliveryId}/status`;
  const start = (t, { user = t.driver, key = randomUUID(), body = { status: 'DELIVERING', note: 'Bắt đầu giao', action: 'START' }, headers = {} } = {}) =>
    f.request(path(t), { user, method: 'PATCH', body, headers: { 'Idempotency-Key': key, ...headers } });
  const note = (t, text, key = randomUUID()) => start(t, { key, body: { status: 'DELIVERING', note: text, action: 'NOTE' } });
  const readEvents = t => StatusHistories.findAll({ where: { DeliveryId: t.deliveryId }, attributes: ['HistoryId', 'StatusType', 'StatusValue', 'Note', 'ChangedBy', 'CreatedAt'], raw: true });
  const pickedTrip = async ({ image = false } = {}) => {
    const t = await f.trip(), issued = await f.issue(t); assert.equal(issued.status, 200, 'Cấp mã D08');
    assert.equal((await f.pickup(t, issued.body.data.pickupCode, image ? { file: { buffer: pngReceipt(), type: 'image/png' } } : {})).status, 200, 'Xác nhận thật qua API D08'); return t;
  };
  const t = await pickedTrip({ image: true });
  await check('JWT thật và đúng phân công: guest/dev/demo/token sai, buyer/seller/driver khác bị chặn', async () => {
    for (const headers of [{}, { 'x-user-id': String(t.driver.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }]) {
      assert.equal((await f.request(path(t), { method: 'PATCH', body: { status: 'DELIVERING' }, headers: { 'Idempotency-Key': randomUUID(), ...headers } })).status, 401);
    }
    for (const user of [f.buyer, f.seller, f.outsider, await f.person(undefined, { driver: true })]) assert.equal((await start(t, { user })).status, 403);
    await Users.update({ Status: 'LOCKED' }, { where: { UserId: t.driver.UserId } }); assert.equal((await start(t)).status, 403);
    await Users.update({ Status: 'ACTIVE' }, { where: { UserId: t.driver.UserId } });
    const grant = await UserRoles.findOne({ where: { UserId: t.driver.UserId } }); await grant.destroy(); assert.equal((await start(t)).status, 403);
    await UserRoles.create({ UserId: t.driver.UserId, RoleId: grant.RoleId });
    await PartnerApplications.update({ Status: 'PENDING' }, { where: { UserId: t.driver.UserId, PartnerType: 'DRIVER' } }); assert.equal((await start(t)).status, 403);
    await PartnerApplications.update({ Status: 'APPROVED' }, { where: { UserId: t.driver.UserId, PartnerType: 'DRIVER' } });
  });
  await check('Strict payload, 500 ký tự, mã chuyến, không nhận DELIVERED hay dữ liệu xác thực D13', async () => {
    for (const body of [{}, { status: 'DELIVERED' }, { status: 'FAILED' }, { status: 'DELIVERING', note: 5 }, { status: 'DELIVERING', note: 'x'.repeat(501) },
      ...['verified', 'DriverId', 'UserId', 'DeliveredAt', 'VerifiedAt', 'ProofUrl', 'CompletionCodeHash', 'CompletedAt'].map(key => ({ status: 'DELIVERING', [key]: true }))]) {
      const r = await start(t, { body }); assert.equal(r.status, 400); if (body.status === 'DELIVERED') assert.equal(r.body.message, 'Vui lòng hoàn tất xác thực giao hàng trước.');
    }
    assert.equal((await start(t, { headers: { 'Idempotency-Key': '' } })).status, 400);
    assert.equal((await start({ ...t, deliveryId: 0 })).status, 400);
    assert.equal((await start({ ...t, deliveryId: 4294967295 })).status, 404);
  });
  const original = await f.read(t), originalOrder = (await t.order.reload()).toJSON(), key = randomUUID(), initialNotes = await Notifications.count(), commissions = await Commissions.count();
  await check('BUSY bắt đầu giao atomically: PICKED_UP -> DELIVERING, PAID -> IN_DELIVERY; giữ tiền, mã và ảnh D08', async () => {
    const r = await start(t, { key, body: { status: 'DELIVERING', note: '  Đã rời điểm lấy  ', action: 'START' } }); assert.equal(r.status, 200);
    assert.equal(r.body.data.deliveryStatus, 'DELIVERING'); assert.equal(r.body.data.orderStatus, 'IN_DELIVERY'); assert.equal(r.body.data.alreadyApplied, false);
    const d = await f.read(t), o = (await t.order.reload()).toJSON();
    for (const field of ['PickupCodeHash', 'PickupProofKey', 'PickupProofDigest', 'ProofUrl', 'CompletionCodeHash', 'DeliveredAt', 'VerifiedAt']) assert.ok(d[field] === original[field], `D09 không đổi ${field}`);
    for (const field of ['PickedUpAt', 'PickupCodeUsedAt']) assert.equal(new Date(d[field]).getTime(), new Date(original[field]).getTime());
    for (const field of ['ProductAmount', 'DeliveryFee', 'TotalAmount', 'CommissionRate', 'CompletedAt']) assert.equal(o[field], originalOrder[field]);
    assert.equal(await Commissions.count(), commissions); assert.equal(await Notifications.count(), initialNotes + 2);
    assert.equal((await DriverProfiles.findOne({ where: { UserId: t.driver.UserId } })).AvailabilityStatus, 'BUSY');
    const events = await readEvents(t), transition = events.filter(e => e.StatusType === 'DELIVERY' && e.StatusValue === 'DELIVERING');
    assert.equal(transition.length, 1); assert.equal(transition[0].ChangedBy, t.driver.UserId); assert.equal(transition[0].Note, 'Đã rời điểm lấy');
    assert.equal(events.filter(e => e.StatusType === 'ORDER' && e.StatusValue === 'IN_DELIVERY').length, 1);
    const preview = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/pickup-preview`, { user: t.driver });
    assert.equal(preview.body.data.progress.allowed, true); assert.ok(!JSON.stringify(preview.body).includes('PickupCodeHash'));
  });
  await check('Retry cùng khóa/cùng ý định không lặp lịch sử/notify; khóa cũ không đổi payload', async () => {
    const before = (await readEvents(t)).length, notifications = await Notifications.count();
    const body = { status: 'DELIVERING', note: 'Đã rời điểm lấy', action: 'START' };
    for (const requestKey of [key, randomUUID()]) { const r = await start(t, { key: requestKey, body }); assert.equal(r.status, 200); assert.equal(r.body.data.alreadyApplied, true); }
    assert.equal((await start(t, { key, body: { ...body, note: 'Nội dung khác' } })).status, 409);
    assert.equal((await readEvents(t)).length, before); assert.equal(await Notifications.count(), notifications);
  });
  await check('Ghi chú có chủ đích: cùng nội dung + khóa mới tạo sự kiện NOTE riêng; retry không trùng', async () => {
    const key = randomUUID(), text = '<b>Đang di chuyển tới điểm giao</b>', before = (await readEvents(t)).length, notifications = await Notifications.count();
    assert.equal((await note(t, text, key)).status, 200); const retried = await note(t, text, key); assert.equal(retried.status, 200); assert.equal(retried.body.data.alreadyApplied, true);
    assert.equal((await note(t, text)).status, 200);
    const events = await readEvents(t); assert.equal(events.length, before + 2); assert.equal(await Notifications.count(), notifications + 4);
    assert.equal(events.filter(e => e.StatusValue === 'PROGRESS_NOTE').length, 2); assert.equal(events.filter(e => e.StatusValue === 'DELIVERING').length, 1);
    for (const user of [f.buyer, f.seller, t.driver]) {
      const tracking = await f.request(`/api/v1/orders/${t.order.OrderId}/tracking`, { user }); assert.equal(tracking.status, 200);
      assert.equal(tracking.body.data.progress.label, 'Đang giao hàng'); assert.equal(tracking.body.data.histories.filter(e => e.status === 'PROGRESS_NOTE').length, 2);
      assert.equal(tracking.body.data.histories.find(e => e.status === 'PROGRESS_NOTE').actor.userId, t.driver.UserId);
      assert.ok(!JSON.stringify(tracking.body).includes('D09RequestHash')); assert.ok(!JSON.stringify(tracking.body).includes('D09RequestId'));
    }
  });
  await check('MySQL concurrency: 2 START khác khóa chỉ một transition; 2 NOTE cùng khóa chỉ một event', async () => {
    const a = await pickedTrip(), before = await Notifications.count();
    const started = await Promise.all([start(a), start(a)]); assert.ok(started.every(r => r.status === 200)); assert.equal(started.filter(r => r.body.data.alreadyApplied).length, 1);
    const key = randomUUID(), notes = await Promise.all([note(a, 'Tiến độ đồng thời', key), note(a, 'Tiến độ đồng thời', key)]);
    assert.ok(notes.every(r => r.status === 200)); assert.equal(notes.filter(r => r.body.data.alreadyApplied).length, 1);
    const events = await readEvents(a); assert.equal(events.filter(e => e.StatusValue === 'DELIVERING').length, 1); assert.equal(events.filter(e => e.StatusValue === 'PROGRESS_NOTE').length, 1);
    assert.equal(await Notifications.count(), before + 4);
  });
  await check('Chặn trước D08, D10/end states, thiếu dấu lấy hàng, sai thanh toán và hồ sơ vận hành', async () => {
    const accepted = await f.trip(); assert.equal((await start(accepted)).status, 409); assert.equal((await note(accepted, 'Không được bỏ bước')).status, 409);
    for (const variant of ['AVAILABLE', 'ACCEPTED', 'FAILED', 'RETURNING', 'RETURNED', 'DELIVERED', 'PICKUP', 'CANCELLED', 'REFUND_PENDING', 'COMPLETED', 'PAYMENT', 'RECEIPT', 'OFFLINE']) {
      const a = await pickedTrip();
      if (['AVAILABLE', 'ACCEPTED', 'FAILED', 'RETURNING', 'RETURNED', 'DELIVERED'].includes(variant)) await Deliveries.update({ Status: variant }, { where: { DeliveryId: a.deliveryId } });
      else if (variant === 'PICKUP') await a.order.update({ DeliveryMethod: 'PICKUP' });
      else if (['CANCELLED', 'REFUND_PENDING', 'COMPLETED'].includes(variant)) await a.order.update({ Status: variant });
      else if (variant === 'PAYMENT') await a.payment.update({ Status: 'REPORTED' });
      else if (variant === 'RECEIPT') await Deliveries.update({ PickupCodeUsedAt: null }, { where: { DeliveryId: a.deliveryId } });
      else await DriverProfiles.update({ AvailabilityStatus: 'OFFLINE' }, { where: { UserId: a.driver.UserId } });
      assert.equal((await start(a)).status, 409);
    }
    const a = await pickedTrip(); await RefundRequests.create({ OrderId: a.order.OrderId, RequestedBy: f.buyer.UserId, Amount: '100000', Reason: 'Fixture', Status: 'PENDING' });
    assert.equal((await start(a)).status, 409);
  });
  await check('Rollback cả ORDER/DELIVERY/history/notify; mất phản hồi sau commit retry không lặp', async () => {
    const a = await pickedTrip(), body = { status: 'DELIVERING', note: 'Transaction', action: 'START' }, key = randomUUID();
    const before = (await readEvents(a)).length, notifications = await Notifications.count();
    let notificationsWritten = 0;
    const failed = createProgressService({ repository: { ...repository, notifyUser: async (...args) => {
      if (++notificationsWritten === 2) throw new Error('injected rollback');
      return repository.notifyUser(...args);
    } } });
    await assert.rejects(failed.update(a.deliveryId, body, key, { UserId: a.driver.UserId }), /injected rollback/);
    assert.equal((await f.read(a)).Status, 'PICKED_UP'); assert.equal((await a.order.reload()).Status, 'PAID'); assert.equal((await readEvents(a)).length, before); assert.equal(await Notifications.count(), notifications);
    const uncertain = createProgressService({ repository: { ...repository, withTransaction: async work => { await repository.withTransaction(work); throw new Error('injected response lost'); } } });
    await assert.rejects(uncertain.update(a.deliveryId, body, key, { UserId: a.driver.UserId }), /injected response lost/);
    assert.equal((await start(a, { key, body })).body.data.alreadyApplied, true); assert.equal((await readEvents(a)).length, before + 2); assert.equal(await Notifications.count(), notifications + 2);
  });
  await check('Retry cũ sau trạng thái xa hơn không kéo lùi; request mới trên chuyến kết thúc bị chặn', async () => {
    await Deliveries.update({ Status: 'DELIVERED' }, { where: { DeliveryId: t.deliveryId } }); await t.order.update({ Status: 'DELIVERED' });
    const before = (await readEvents(t)).length;
    const r = await start(t, { key, body: { status: 'DELIVERING', note: 'Đã rời điểm lấy', action: 'START' } });
    assert.equal(r.status, 200); assert.equal(r.body.data.alreadyApplied, true); assert.equal(r.body.data.deliveryStatus, 'DELIVERED');
    assert.equal((await note(t, 'Không được ghi mới')).status, 409); assert.equal((await start(t)).status, 409); assert.equal((await readEvents(t)).length, before);
  });
  await check('Đồng thời hoàn tiền/chuyển hoàn: ORDER mutex không ghi đè trạng thái mới', async () => {
    const a = await pickedTrip();
    const [progress, refund] = await Promise.all([start(a), f.request(`/api/v1/orders/${a.order.OrderId}/refund-requests`, { user: f.buyer, method: 'POST', body: {
      reason: 'Không nhận được hàng', refundBankCode: '970418', refundAccountNumber: '1234567890', refundAccountHolder: 'TEST' } })]);
    assert.equal(refund.status, 201); assert.ok([200, 409].includes(progress.status)); assert.equal((await a.order.reload()).Status, 'REFUND_PENDING'); assert.equal((await note(a, 'Chặn sau hoàn tiền')).status, 409);
    const b = await pickedTrip();
    const other = sequelize.transaction(async tx => {
      await Orders.findByPk(b.order.OrderId, { transaction: tx, lock: tx.LOCK.UPDATE });
      await Deliveries.update({ Status: 'RETURNING' }, { where: { DeliveryId: b.deliveryId }, transaction: tx });
    });
    const [r] = await Promise.all([start(b), other]); assert.ok([200, 409].includes(r.status)); assert.equal((await f.read(b)).Status, 'RETURNING');
  });
  console.log(`PASS: ${count} nhóm D09 trên ${f.connection.db}; không seed/reset DB đang dùng, không CD/SMTP, không log mã/token.`);
}
main().catch(e => { console.error('FAIL D09:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (environment) await environment.close(); });
