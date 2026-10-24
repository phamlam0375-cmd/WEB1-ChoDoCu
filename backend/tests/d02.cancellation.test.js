'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createCancellationService } = require('../src/services/D02_HuyDonHang/cancellation.service');
const { validateOrderId, validateCancelReason } = require('../src/validators/D02_HuyDonHang/cancellation.validator');
const app = require('../src/app');
const models = require('../src/models');
const actualRepository = require('../src/repositories/D02_HuyDonHang/cancellation.repository');
const orderRepository = require('../src/repositories/order.repository');

const buyer = { UserId: 71 };
function fixture(changes = {}) {
  const state = {
    order: { OrderId: 91, BuyerId: 71, SellerId: 82, ListingId: 42, Status: 'RESERVED', ProductAmount: '123456.00', DeliveryFee: '0.00', TotalAmount: '123456.00', CancelReason: null },
    listing: { ListingId: 42, Title: 'Fixture', Status: 'RESERVED' }, payment: null, deliveries: [], refund: null,
    histories: [], notifications: [], otherOrder: false, ...changes,
  };
  let queue = Promise.resolve();
  const repository = {
    async withTransaction(work) {
      const prior = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await prior;
      const saved = structuredClone(state);
      try { return await work({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (err) { Object.assign(state, saved); throw err; }
      finally { release(); }
    },
    async readState(id) { return state.order?.OrderId === id ? structuredClone(state) : null; },
    async markCancelled(order, reason) {
      if (state.order.Status !== order.Status) return 0;
      Object.assign(state.order, { Status: 'CANCELLED', CancelReason: reason }); return 1;
    },
    async reopenListing() {
      if (state.listing.Status !== 'RESERVED' || state.otherOrder) return 0;
      state.listing.Status = 'ACTIVE'; return 1;
    },
    async createHistory(data) { state.histories.push(data); },
    async notifyUser(userId, data) { state.notifications.push({ userId, ...data }); },
  };
  return { state, repository, service: createCancellationService({ repository }) };
}

test('D02 hủy RESERVED/WAITING_PAYMENT, trim lý do, giữ tiền/lịch sử/thông báo', async () => {
  for (const status of ['RESERVED', 'WAITING_PAYMENT']) {
    const f = fixture(); f.state.order.Status = status;
    const result = await f.service.cancelOrder('91', { reason: '  Không còn nhu cầu  ' }, buyer);
    assert.equal(result.message, 'Đơn #91 đã được hủy.');
    assert.equal(result.data.cancelReason, 'Không còn nhu cầu');
    assert.equal(result.data.listingReopened, true);
    assert.equal(f.state.order.Status, 'CANCELLED');
    assert.equal(f.state.order.TotalAmount, '123456.00');
    assert.equal(f.state.histories[0].ChangedBy, 71);
    assert.equal(f.state.histories[0].Note, 'Không còn nhu cầu');
    assert.deepEqual(f.state.notifications.map(n => n.userId), [71, 82]);
  }
});

test('D02 validation: lý do bắt buộc/500 ký tự, ID uint32, không nhận trạng thái/tài khoản client', () => {
  for (const id of ['abc', '1.5', '1e2', '-1', '0', 4294967296, null]) assert.throws(() => validateOrderId(id), { status: 400 });
  for (const body of [{}, null, { reason: '  ' }, { reason: 5 }, { reason: 'a'.repeat(501) }, { reason: 'ok', buyerId: 71 }, { reason: 'ok', status: 'CANCELLED' }]) assert.throws(() => validateCancelReason(body), { status: 400 });
  assert.equal(validateCancelReason({ reason: ' a ' }), 'a');
  assert.equal(validateCancelReason({ reason: 'a'.repeat(500) }).length, 500);
});

test('D02 không có đơn/không đúng người mua/kể cả seller hoặc admin đều không có quyền D02', async () => {
  const f = fixture();
  await assert.rejects(f.service.cancelOrder(99, { reason: 'Khác' }, buyer), { status: 404, code: 'ORDER_NOT_FOUND' });
  for (const user of [null, { UserId: 82, roles: ['SELLER'] }, { UserId: 2, roles: ['ADMIN'] }]) {
    await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, user), { status: user ? 403 : 401 });
  }
  assert.equal(f.state.histories.length, 0);
});

test('D02 paid từ Orders hoặc Payments chỉ dẫn B06, không tạo refund/đổi đơn/hoa hồng', async () => {
  for (const status of ['PAID', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'RESERVED', 'WAITING_PAYMENT']) {
    const f = fixture(); f.state.order.Status = status; f.state.payment = { Status: 'CONFIRMED' };
    const snapshot = structuredClone(f.state);
    const preview = await f.service.getCancellationPreview(91, buyer);
    assert.equal(preview.refundUrl, '/orders/91/refund');
    await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), err => err.status === 409 && err.code === 'REFUND_REQUIRED' && err.errors.refundUrl === '/orders/91/refund');
    assert.deepEqual(f.state, snapshot);
  }
});

test('D02 REPORTED/unknown payment và delivery chưa kết thúc không giải phóng món', async () => {
  for (const payment of [{ Status: 'REPORTED' }, { Status: 'NEW_UNKNOWN_STATE' }]) {
    const f = fixture({ payment });
    await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { status: 409 });
    assert.equal(f.state.listing.Status, 'RESERVED'); assert.equal(f.state.order.Status, 'RESERVED');
    assert.equal(f.state.histories.length, 0);
  }
  for (const status of ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERING', 'RETURNING', 'RETURNED']) {
    const f = fixture({ deliveries: [{ Status: status }] });
    await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { code: 'ORDER_NOT_CANCELLABLE' });
  }
});

test('D02 WAITING/REJECTED chưa thu tiền cho phép hủy; refund/unknown order không cho phép', async () => {
  for (const Status of ['WAITING', 'REJECTED']) {
    const f = fixture({ payment: { Status } }); assert.equal((await f.service.cancelOrder(91, { reason: 'Khác' }, buyer)).data.status, 'CANCELLED');
  }
  for (const Status of ['REFUND_PENDING', 'REFUNDED', 'NEW_UNKNOWN_STATE']) {
    const f = fixture(); f.state.order.Status = Status;
    await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { code: 'ORDER_NOT_CANCELLABLE' });
  }
  const f = fixture({ refund: { Status: 'PENDING' } });
  await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { code: 'ORDER_NOT_CANCELLABLE' });
});

test('D02 retry/hai request song song: một thay đổi, giữ lý do đầu, không trùng lịch sử/thông báo', async () => {
  const f = fixture();
  const results = await Promise.all(['Lý do đầu', 'Lý do sau'].map(reason => f.service.cancelOrder(91, { reason }, buyer)));
  assert.deepEqual(results.map(r => r.data.alreadyCancelled), [false, true]);
  assert.equal(f.state.order.CancelReason, 'Lý do đầu');
  await f.service.cancelOrder(91, { reason: 'Gửi lại' }, buyer);
  assert.equal(f.state.histories.length, 1); assert.equal(f.state.notifications.length, 2);
});

test('D02 không mở SOLD/HIDDEN/REMOVED hoặc tin thuộc đơn khác, vẫn chỉ hủy đúng đơn', async () => {
  for (const Status of ['SOLD', 'HIDDEN', 'REMOVED', 'PENDING']) {
    const f = fixture(); f.state.listing.Status = Status;
    const r = await f.service.cancelOrder(91, { reason: 'Khác' }, buyer);
    assert.equal(r.data.listingReopened, false); assert.equal(f.state.listing.Status, Status);
  }
  const f = fixture({ otherOrder: true });
  assert.equal((await f.service.cancelOrder(91, { reason: 'Khác' }, buyer)).data.listingReopened, false);
});

test('D02 lỗi notification rollback; conditional update thất bại/deadlock là 409', async () => {
  const f = fixture(); const before = structuredClone(f.state);
  f.repository.notifyUser = async () => { throw new Error('notify unavailable'); };
  await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), /notify unavailable/);
  assert.deepEqual(f.state, before);
  f.repository.markCancelled = async () => 0;
  await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { status: 409 });
  f.repository.withTransaction = async () => { throw { original: { code: 'ER_LOCK_DEADLOCK' } }; };
  await assert.rejects(f.service.cancelOrder(91, { reason: 'Khác' }, buyer), { status: 409, code: 'ORDER_CONFLICT' });
});

test('D02 production route thật: demo scoped/ownership, no demo off, không mở admin/refund', async t => {
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '71' });
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  t.mock.method(models.Users, 'findByPk', async () => ({ ...buyer, Status: 'ACTIVE', Roles: [{ RoleName: 'USER' }] }));
  const f = fixture();
  for (const key of Object.keys(f.repository)) t.mock.method(actualRepository, key, f.repository[key]);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, method = 'GET', body, headers = { 'x-d01-demo': 'true', 'x-user-id': '2' }) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { ...headers, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  }
  assert.equal((await request('/api/v1/orders/91/cancellation-preview')).body.data.orderId, 91);
  assert.equal((await request('/api/v1/orders/91/cancel', 'PATCH', {})).status, 400);
  assert.equal((await request('/api/v1/orders/91/cancel', 'PATCH', { reason: 'Test' })).status, 200);
  assert.equal((await request('/api/v1/orders/91/cancel', 'PATCH', { reason: 'Retry' })).body.data.alreadyCancelled, true);
  f.state.order.BuyerId = 99;
  assert.equal((await request('/api/v1/orders/91/cancellation-preview')).status, 403);
  for (const path of ['/api/v1/admin/users', '/api/v1/me']) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/api/v1/orders/91/refund-requests', 'POST', { reason: 'Khác' })).status, 401);
  process.env.D01_DEMO_MODE = 'false';
  assert.equal((await request('/api/v1/orders/91/cancel', 'PATCH', { reason: 'Test' })).status, 401);
});

test('D01 job repository chặn REPORTED/CONFIRMED/unknown payment và delivery', async t => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const update = t.mock.method(models.Orders, 'update', async () => [1]);
  let payment, delivery = [];
  t.mock.method(models.Payments, 'findOne', async () => payment);
  t.mock.method(models.sequelize, 'query', async () => delivery);
  for (const Status of ['REPORTED', 'CONFIRMED', 'UNKNOWN']) {
    payment = { Status }; assert.equal(await orderRepository.cancelExpiredOrder(91, new Date(), 'Hết hạn', tx), 0);
  }
  payment = null; delivery = [{ DeliveryId: 1 }];
  assert.equal(await orderRepository.cancelExpiredOrder(91, new Date(), 'Hết hạn', tx), 0);
  assert.equal(update.mock.callCount(), 0);
  delivery = [];
  assert.equal(await orderRepository.cancelExpiredOrder(91, new Date(), 'Hết hạn', tx), 1);
});

test('shared reopenListing khóa đúng tin, blocker ngăn mở lại, WHERE vẫn RESERVED', async t => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  let status = 'RESERVED', blockers = [{ OrderId: 92 }];
  t.mock.method(models.Listings, 'findByPk', async (id, opts) => { assert.equal(id, 42); assert.equal(opts.lock, 'UPDATE'); return { Status: status }; });
  t.mock.method(models.sequelize, 'query', async (sql, opts) => {
    assert.equal(opts.replacements.listingId, 42); assert.match(sql, /FOR UPDATE/); assert.match(sql, /Payments/); assert.match(sql, /Deliveries/); return blockers;
  });
  const writes = t.mock.method(models.Listings, 'update', async (_data, opts) => { assert.deepEqual(opts.where, { ListingId: 42, Status: 'RESERVED' }); return [1]; });
  assert.equal(await orderRepository.reopenListing(42, tx), 0);
  blockers = []; status = 'SOLD'; assert.equal(await orderRepository.reopenListing(42, tx), 0);
  status = 'RESERVED'; assert.equal(await orderRepository.reopenListing(42, tx), 1);
  assert.equal(writes.mock.callCount(), 1);
});
