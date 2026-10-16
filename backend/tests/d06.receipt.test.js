'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReceiptService, receiptPolicy } = require('../src/services/D06_XacNhanNhanHang/receipt.service');
const { validateConfirmation, validateOrderId } = require('../src/validators/D06_XacNhanNhanHang/receipt.validator');
const buyer = { UserId: 11 }, now = new Date('2026-10-16T08:00:00Z');
function fixture() {
  let state = {
    order: { OrderId: 91, BuyerId: 11, SellerId: 12, ListingId: 41, Status: 'DELIVERED', DeliveryMethod: 'DELIVERY', ProductAmount: '123456.10', DeliveryFee: '25000.00', TotalAmount: '148456.10', CommissionRate: '2.50', CreatedAt: '2026-10-15T08:00:00Z', CompletedAt: null },
    payment: { OrderId: 91, PayerId: 11, PayeeId: 12, Amount: '123456.10', Status: 'CONFIRMED', ConfirmedBy: 12, ReportedAt: '2026-10-15T09:00:00Z', ConfirmedAt: '2026-10-15T09:01:00Z', ProofUrl: '/api/v1/uploads/receipt.png', BankName: 'LOCAL TEST BANK', BankAccountSnapshot: '000123456789', BankAccountHolderSnapshot: 'LOCAL SELLER', TransferContent: 'D06 91' },
    deliveries: [{ OrderId: 91, DeliveryId: 8, DriverId: 13, Status: 'DELIVERED', VerifiedAt: '2026-10-15T10:00:00Z', DeliveredAt: '2026-10-15T10:00:00Z', ProofUrl: '/api/v1/uploads/delivery.png' }],
    listing: { ListingId: 41, SellerId: 12, Status: 'RESERVED', Title: 'Fixture' }, refunds: [], commissions: [], histories: [], notifications: [],
  };
  let queue = Promise.resolve();
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const repository = {
    withTransaction(work) {
      const result = queue.then(async () => { const before = structuredClone(state); try { return await work(tx); } catch (error) { state = before; throw error; } });
      queue = result.catch(() => {}); return result;
    },
    withSnapshot: work => work(tx),
    readOrder: async id => id === 91 ? state.order : null,
    readRelated: async () => state,
    markCompleted: async (_o, at, t) => { assert.equal(t, tx); Object.assign(state.order, { Status: 'COMPLETED', CompletedAt: at }); return 1; },
    markListingSold: async (_o, t) => { assert.equal(t, tx); if (state.listing.Status === 'RESERVED') state.listing.Status = 'SOLD'; },
    createCommission: async (id, t) => { assert.equal(t, tx); assert.equal(state.order.Status, 'COMPLETED'); state.commissions.push(id); },
    createHistory: async (h, t) => { assert.equal(t, tx); state.histories.push(h); },
    notifyUser: async (id, p, t) => { assert.equal(t, tx); state.notifications.push({ id, ...p }); },
  };
  return { get state() { return state; }, repository, service: createReceiptService({ repository, clock: () => now }) };
}
test('D06 validation: strict boolean only, no client-controlled identity/time/status/money', () => {
  for (const body of [null, [], {}, { received: false }, { received: 'true' }, { received: 1 }]) assert.throws(() => validateConfirmation(body), { status: 400 });
  for (const key of ['BuyerId', 'userId', 'ChangedBy', 'CompletedAt', 'Status', 'ProductAmount', 'CommissionRate']) assert.throws(() => validateConfirmation({ received: true, [key]: 1 }), { status: 400 });
  for (const id of ['x', '0', '-1', '1.1', '4294967296']) assert.throws(() => validateOrderId(id), { status: 400 });
  validateConfirmation({ received: true });
});
test('D06 chỉ đúng người mua, không chấp nhận demo hoặc đặc quyền seller/driver/admin', async () => {
  for (const [user, status] of [[null, 401], [{ UserId: 11, d01Demo: true }, 401], [{ UserId: 12, roles: ['SELLER'] }, 403], [{ UserId: 13, roles: ['DRIVER'] }, 403], [{ UserId: 14, roles: ['ADMIN'] }, 403]]) {
    const f = fixture(); await assert.rejects(f.service.getPreview(91, user), { status }); await assert.rejects(f.service.confirmReceived(91, { received: true }, user), { status }); assert.equal(f.state.histories.length, 0);
  }
  await assert.rejects(fixture().service.getPreview(92, buyer), { status: 404 });
});
test('D06 mọi trạng thái chưa giao/hủy/hoàn tiền đều chặn; PICKUP không tự dựng C07/D13', async () => {
  for (const variant of ['RESERVED', 'WAITING_PAYMENT', 'PAID', 'IN_DELIVERY', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PICKUP']) {
    const f = fixture(); if (variant === 'PICKUP') f.state.order.DeliveryMethod = variant; else f.state.order.Status = variant;
    await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), { status: 409 }); assert.equal(f.state.histories.length, 0);
  }
});
test('D06 Orders.DELIVERED chưa đủ: thiếu/sai chuyến, driver, ảnh, VerifiedAt/DeliveredAt tương lai, đang chuyển hoàn', async () => {
  for (const key of ['missing', 'duplicate', 'OrderId', 'DriverId', 'Status', 'ProofUrl', 'VerifiedAt', 'DeliveredAt', 'future', 'ReturnedAt']) {
    const f = fixture(), d = f.state.deliveries[0];
    if (key === 'missing') f.state.deliveries = [];
    else if (key === 'duplicate') f.state.deliveries.push({ ...d });
    else if (key === 'future') d.VerifiedAt = '2099-01-01';
    else d[key] = ({ OrderId: 92, DriverId: 0, Status: 'RETURNING', ReturnedAt: now })[key] ?? null;
    await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), { code: 'DELIVERY_NOT_VERIFIED', status: 409 });
  }
});
test('D06 thanh toán D04 phải hợp lệ đúng order/payer/payee/amount/seller, bằng chứng và thời điểm', async () => {
  for (const key of ['missing', 'Status', 'OrderId', 'PayerId', 'PayeeId', 'Amount', 'ConfirmedBy', 'ConfirmedAt', 'ReportedAt', 'ProofUrl', 'BankName', 'BankAccountSnapshot', 'BankAccountHolderSnapshot', 'TransferContent', 'future']) {
    const f = fixture();
    if (key === 'missing') f.state.payment = null;
    else if (key === 'future') f.state.payment.ConfirmedAt = '2099-01-01';
    else f.state.payment[key] = ({ Status: 'REPORTED', OrderId: 92, PayerId: 12, PayeeId: 11, Amount: '123456.11', ConfirmedBy: 11 })[key] ?? null;
    await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), { status: 409, code: 'PAYMENT_NOT_CONFIRMED' });
  }
});
test('D06 refund hoạt động hoặc đã hoàn tiền không thể bị ghi đè; từ chối cũ không chặn', async () => {
  for (const status of ['PENDING', 'REVIEWING', 'APPROVED', 'SELLER_TRANSFERRED', 'DISPUTED', 'COMPLETED']) {
    const f = fixture(); f.state.refunds.push({ Status: status }); await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), { code: 'REFUND_ACTIVE' });
  }
  const f = fixture(); f.state.refunds.push({ Status: 'REJECTED' }); assert.equal(receiptPolicy(f.state, now).canConfirm, true);
});
test('D06 preview read-only và DTO không lộ ảnh chứng từ, driver, số tài khoản; B06 đúng đơn, C09 không giả link', async () => {
  const f = fixture(), before = structuredClone(f.state), dto = await f.service.getPreview(91, buyer);
  assert.deepEqual(f.state, before); assert.equal(dto.policy.canConfirm, true); assert.equal(dto.capabilities.refund.href, '/orders/91/refund'); assert.equal(dto.capabilities.review.enabled, false);
  for (const key of ['ProofUrl', 'ConfirmedBy', 'BankAccount', 'DriverId']) assert(!JSON.stringify(dto).includes(key));
});
test('D06 hợp lệ: COMPLETED, server time, ChangedBy buyer, hoa hồng dùng cùng transaction, SOLD và 2 thông báo', async () => {
  const f = fixture(), before = structuredClone(f.state.order);
  const result = await f.service.confirmReceived(91, { received: true }, buyer);
  assert.equal(result.data.orderStatus, 'COMPLETED'); assert.equal(f.state.order.CompletedAt, now); assert.equal(f.state.listing.Status, 'SOLD');
  assert.deepEqual(f.state.commissions, [91]); assert.equal(f.state.histories.length, 1); assert.equal(f.state.histories[0].ChangedBy, 11); assert.equal(f.state.histories[0].CreatedAt, now);
  assert.deepEqual(f.state.notifications.map(n => n.id), [12, 11]);
  for (const key of ['ProductAmount', 'DeliveryFee', 'TotalAmount', 'CommissionRate']) assert.equal(f.state.order[key], before[key]);
});
test('D06 idempotent và hai request đồng thời không đổi CompletedAt, không trùng side effects', async () => {
  const f = fixture(), results = await Promise.all([f.service.confirmReceived(91, { received: true }, buyer), f.service.confirmReceived(91, { received: true }, buyer)]);
  assert.equal(results.filter(r => r.data.alreadyCompleted).length, 1); const before = structuredClone(f.state);
  await f.service.confirmReceived(91, { received: true }, buyer); assert.deepEqual(f.state, before); assert.equal(f.state.histories.length, 1); assert.equal(f.state.commissions.length, 1); assert.equal(f.state.notifications.length, 2);
});
test('D06 lỗi bất kỳ side effect rollback cả đơn/hoa hồng/tin/lịch sử/thông báo', async () => {
  for (const method of ['createCommission', 'markListingSold', 'createHistory', 'notifyUser']) {
    const f = fixture(), before = structuredClone(f.state); f.repository[method] = async () => { throw new Error('rollback fixture'); };
    await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), /rollback fixture/); assert.deepEqual(f.state, before);
  }
});
test('D06 không ghi đè trạng thái kiểm duyệt tin hoặc đưa sản phẩm trở lại ACTIVE', async () => {
  const f = fixture(); f.state.listing.Status = 'HIDDEN'; await f.service.confirmReceived(91, { received: true }, buyer); assert.equal(f.state.listing.Status, 'HIDDEN');
});
test('D06 cập nhật có điều kiện thất bại và lock timeout/deadlock là 409, không ghi dở', async () => {
  const f = fixture(); f.repository.markCompleted = async () => 0;
  await assert.rejects(f.service.confirmReceived(91, { received: true }, buyer), { code: 'ORDER_CONFLICT' }); assert.equal(f.state.commissions.length, 0);
  for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    const r = fixture(); r.repository.withTransaction = async () => { throw { original: { code } }; };
    await assert.rejects(r.service.confirmReceived(91, { received: true }, buyer), { status: 409, code: 'ORDER_CONFLICT' });
  }
});

test('D06 router dùng JWT thật cả dev/production dù demo/dev đang bật; controller đúng buyer, retry không ghi lại', async t => {
  const app = require('../src/app'), { Users } = require('../src/models');
  const repo = require('../src/repositories/D06_XacNhanNhanHang/receipt.repository');
  const crypto = require('node:crypto');
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { AUTH_DEV_HEADER: 'true', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '11', JWT_SECRET: 'd06-unit-test-only' });
  const identity = t.mock.method(Users, 'findByPk', async id => ({ UserId: Number(id), FullName: 'D06 buyer', Status: 'ACTIVE', Roles: [] }));
  const f = fixture(); f.state.order.Status = 'COMPLETED'; f.state.order.CompletedAt = now;
  t.mock.method(repo, 'withSnapshot', async work => work({}));
  t.mock.method(repo, 'withTransaction', async work => work({}));
  t.mock.method(repo, 'readOrder', async id => id === 91 ? f.state.order : null);
  t.mock.method(repo, 'readRelated', async () => f.state);
  for (const method of ['markCompleted', 'markListingSold', 'createCommission', 'createHistory', 'notifyUser']) t.mock.method(repo, method, async () => assert.fail('Completed retry must not write'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = async (method, path, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/orders${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, ...(method === 'PATCH' ? { body: JSON.stringify({ received: true }) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  const jwt = id => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 60 })}`;
    return `Bearer ${content}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(content).digest('base64url')}`;
  };
  for (process.env.NODE_ENV of ['development', 'production']) {
    for (const [method, path] of [['GET', '/91/received-preview'], ['PATCH', '/91/received']]) {
      for (const headers of [{}, { 'x-user-id': '11' }, { 'x-d01-demo': 'true' }, { authorization: 'Bearer invalid', 'x-user-id': '11' }]) assert.equal((await request(method, path, headers)).status, 401);
    }
  }
  assert.equal(identity.mock.callCount(), 0);
  assert.equal((await request('GET', '/91/received-preview', { authorization: jwt(12) })).status, 403);
  const preview = await request('GET', '/91/received-preview', { authorization: jwt(11) }); assert.equal(preview.status, 200); assert.equal(preview.body.data.orderStatus, 'COMPLETED');
  const repeat = await request('PATCH', '/91/received', { authorization: jwt(11), 'x-user-id': '12' }); assert.equal(repeat.status, 200); assert.equal(repeat.body.data.alreadyCompleted, true);
  assert.equal((await request('GET', '/abc/received-preview', { authorization: jwt(11) })).status, 400);
  assert.equal((await request('GET', '/92/received-preview', { authorization: jwt(11) })).status, 404);
});
