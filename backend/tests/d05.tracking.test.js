'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createTrackingService, progress, safeNote } = require('../src/services/D05_TheoDoiDonHang/tracking.service');
const { refundEligibility } = require('../src/controllers/refunds.controller');
const v = require('../src/validators/D05_TheoDoiDonHang/tracking.validator');
const buyer = { UserId: 1, roles: ['USER'] }, seller = { UserId: 3, roles: ['SELLER'] };
function fixture() {
  const state = { order: { OrderId: 91, BuyerId: 1, SellerId: 3, ListingId: 42, Status: 'WAITING_PAYMENT', ProductAmount: '123456.10', DeliveryFee: '23000.00', TotalAmount: '146456.10', DeliveryMethod: 'DELIVERY', CreatedAt: '2026-10-12T00:00:00Z', ReservedUntil: '2026-10-12T00:15:00Z', ReceiverName: 'Snapshot buyer', ReceiverPhone: '0900000001', ReceiverAddress: 'Snapshot address', CompletedAt: null },
    seller: { UserId: 3, FullName: 'Seller', Status: 'ACTIVE', PasswordHash: 'PRIVATE' }, listing: { Title: 'Product', Price: '999999999.00' }, store: { Status: 'ACTIVE', BankName: 'BANK', BankAccountNumber: '00123', BankAccountHolder: 'SELLER' },
    payment: { PaymentId: 7, OrderId: 91, PayerId: 1, PayeeId: 3, Amount: '123456.10', Status: 'REPORTED', BankName: 'BANK', BankAccountSnapshot: '00123', BankAccountHolderSnapshot: 'SELLER', TransferContent: 'PAY91', ProofUrl: '/api/v1/uploads/p.png', ReportedAt: '2026-10-12T01:00:00Z' },
    report: { HistoryId: 1 }, refund: null, refunds: [], deliveries: [], histories: [], historyPagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, refundWindowDays: 7 };
  const calls = [];
  const repository = { withSnapshot: async work => work({ snapshot: true }), readState: async id => id === 91 ? state : null,
    readRelated: async (s, opts, driver, tx) => { calls.push({ opts, driver, tx }); return { ...s, histories: driver ? s.histories.filter(h => ['ORDER', 'DELIVERY'].includes(h.StatusType)) : s.histories }; },
    list: async (id, opts, tx) => { calls.push({ id, opts, tx }); return { rows: [state], pagination: { page: opts.page, limit: opts.limit, total: 1, totalPages: 1 } }; } };
  return { state, calls, repository, service: createTrackingService({ repository, clock: () => new Date('2026-10-12T02:00:00Z') }) };
}
test('D05 list uses authenticated buyer, bounded paging, stable sort; no caller BuyerId', async () => {
  const f = fixture(); const result = await f.service.listOrders({ page: '2', limit: '999', sort: 'oldest', status: 'PAID' }, buyer);
  assert.equal(f.calls[0].id, 1); assert.equal(f.calls[0].opts.limit, 100); assert.equal(f.calls[0].opts.offset, 100); assert.equal(f.calls[0].opts.sort, 'oldest');
  assert.equal(result.data[0].productAmount, '123456.10'); assert.equal(result.data[0].seller.name, 'Seller');
  assert(!JSON.stringify(result).includes('PRIVATE')); assert.equal(result.viewer.userId, 1);
  await assert.rejects(f.service.listOrders({ BuyerId: '3' }, buyer), { status: 400 });
});
test('D05 buyer/seller and exact assigned DRIVER only; no admin or guessed-role bypass', async () => {
  const f = fixture();
  for (const user of [buyer, seller]) assert.equal((await f.service.getTracking(91, {}, user)).viewer.userId, user.UserId);
  for (const user of [{ UserId: 2, roles: ['ADMIN'] }, { UserId: 4, roles: ['SELLER'] }, { UserId: 5, roles: ['DRIVER'] }]) await assert.rejects(f.service.getTracking(91, {}, user), { status: 403 });
  await assert.rejects(f.service.getTracking(91, {}, null), { status: 401 }); await assert.rejects(f.service.getTracking(92, {}, buyer), { status: 404 });
  f.state.deliveries = [{ DeliveryId: 9, DriverId: 5, Status: 'DELIVERING', PickupCodeHash: 'PRIVATE-OTP' }];
  assert.equal((await f.service.getTracking(91, {}, { UserId: 5, roles: ['DRIVER'] })).viewer.role, 'DRIVER');
  await assert.rejects(f.service.getTracking(91, {}, { UserId: 5, roles: ['USER'] }), { status: 403 });
  f.state.order.DeliveryMethod = 'PICKUP'; await assert.rejects(f.service.getTracking(91, {}, { UserId: 5, roles: ['DRIVER'] }), { status: 403 });
});
test('D05 snapshot money/receiver, read-only repeat, no bank/proof/token/OTP exposure, driver finance stripped', async () => {
  const f = fixture(); f.state.histories.push({ HistoryId: 1, StatusType: 'ORDER', StatusValue: 'WAITING_PAYMENT', CreatedAt: '2026-10-12T00:00:00Z', Note: 'OTP: 123456' });
  const before = structuredClone(f.state), a = await f.service.getTracking(91, {}, buyer), b = await f.service.getTracking(91, {}, buyer);
  assert.deepEqual(f.state, before); assert.equal(a.version, b.version); assert.equal(a.receiver.address, 'Snapshot address'); assert.equal(a.productAmount, '123456.10');
  const json = JSON.stringify(a); for (const secret of ['PasswordHash', 'BankAccountSnapshot', 'ProofUrl', '123456"', 'OTP:', 'PRIVATE']) assert(!json.includes(secret));
  assert.equal(a.histories[0].note, 'Đã ẩn nội dung bảo mật.');
  f.state.deliveries = [{ DeliveryId: 1, DriverId: 5, Status: 'DELIVERING', PickupCodeHash: 'PRIVATE' }];
  const driver = await f.service.getTracking(91, {}, { UserId: 5, roles: ['DRIVER'] });
  assert.equal(driver.productAmount, undefined); assert.equal(driver.totalAmount, undefined); assert.equal(driver.payment.amount, undefined); assert(!JSON.stringify(driver).includes('PRIVATE'));
  assert(Object.values(driver.capabilities).every(action => !action.enabled));
});
test('D05 real branches: REPORTED not paid; REJECTED resend; delivered not completed; pickup no driver; exceptions/refunds/cancel', async () => {
  const f = fixture(); assert.match(progress(f.state).label, /chờ xác nhận/);
  f.state.payment.Status = 'REJECTED'; assert.match(progress(f.state).description, /không tự chuyển thêm tiền/);
  assert.equal((await f.service.getTracking(91, {}, buyer)).capabilities.payment.enabled, true);
  f.state.order.Status = 'PAID'; f.state.payment.Status = 'CONFIRMED'; assert.match(progress(f.state).description, /Chưa có tài xế/);
  f.state.order.DeliveryMethod = 'PICKUP'; assert.equal(progress(f.state).branch, 'PICKUP');
  f.state.order.DeliveryMethod = 'DELIVERY';
  for (const status of ['FAILED', 'RETURNING', 'RETURNED']) { f.state.deliveries = [{ Status: status }]; assert.equal(progress(f.state).branch, 'DELIVERY_EXCEPTION'); }
  f.state.deliveries = [{ Status: 'DELIVERED' }]; assert.match(progress(f.state).label, /chưa hoàn tất/);
  for (const [status, branch] of [['CANCELLED', 'CANCEL'], ['REFUND_PENDING', 'REFUND'], ['REFUNDED', 'REFUND'], ['COMPLETED', 'COMPLETE']]) { f.state.order.Status = status; assert.equal(progress(f.state).branch, branch); }
});
test('D05 capabilities reuse D02/D03/D04/B06, no absent D06/C08 route and demo cannot enter refund', async () => {
  const f = fixture();
  assert.equal((await f.service.getTracking(91, {}, seller)).capabilities.confirmPayment.href, '/seller/orders/91/payment');
  assert.equal((await f.service.getTracking(91, {}, buyer)).capabilities.cancel.enabled, false);
  f.state.payment = null;
  let data = await f.service.getTracking(91, {}, buyer); assert.equal(data.capabilities.cancel.href, '/orders/91/cancel'); assert.equal(data.capabilities.payment.href, '/orders/91/payment');
  f.state.order.Status = 'RESERVED'; data = await f.service.getTracking(91, {}, buyer); assert.equal(data.capabilities.payment.enabled, false); assert.equal(data.reservedUntil, f.state.order.ReservedUntil);
  f.state.order.Status = 'PAID'; data = await f.service.getTracking(91, {}, buyer); assert.equal(data.reservedUntil, null); assert.equal(data.capabilities.refund.href, '/orders/91/refund');
  data = await f.service.getTracking(91, {}, { ...buyer, d01Demo: true }); assert.equal(data.capabilities.refund.enabled, false);
  assert.equal(data.capabilities.receive.href, null); assert.equal(data.capabilities.chat.href, null);
});
test('D05 validation: IDs, pagination/filter/sort/history; no SQL sort or identity injection', () => {
  for (const id of ['x', '1e2', '0', '4294967296']) assert.throws(() => v.validateOrderId(id), { status: 400 });
  for (const query of [{ page: '0' }, { limit: '2x' }, { page: '9007199254740991' }, { status: 'DELIVERING' }, { sort: 'DROP TABLE Orders' }, { BuyerId: '1' }, { status: ['PAID'] }, { limit: {} }]) assert.throws(() => v.validateList(query), { status: 400 });
  assert.equal(v.validateTracking({ historyLimit: '999' }).limit, 100); assert.throws(() => v.validateTracking({ historyPage: '0' }), { status: 400 });
});
test('B06 eligibility preserves open/closed/paid/CompletedAt time-window rules and boundary', () => {
  const f = fixture(), now = new Date('2026-10-12T02:00:00Z');
  const eligible = () => refundEligibility({ ...f.state, now, windowDays: 7 });
  assert.equal(eligible().enabled, false); f.state.payment.Status = 'CONFIRMED'; assert.equal(eligible().enabled, true);
  f.state.refund = { Status: 'PENDING' }; assert.equal(eligible().status, 409); f.state.refund.Status = 'REJECTED'; assert.equal(eligible().enabled, true);
  f.state.order.Status = 'REFUND_PENDING'; assert.equal(eligible().enabled, false); f.state.order.Status = 'COMPLETED';
  f.state.order.CompletedAt = '2026-10-05T02:00:00Z'; assert.equal(eligible().enabled, true);
  f.state.order.CompletedAt = '2026-10-05T01:59:59Z'; assert.equal(eligible().enabled, false);
  f.state.refunds = [{ Status: 'COMPLETED' }, { Status: 'PENDING' }]; assert.equal(eligible().status, 409);
});
test('D05 timeline safe D04 human note, D03 event, unknown-group fallback and no fake events', () => {
  assert.equal(safeNote({ Note: 'D04 {"action":"REJECT","reportVersion":"PRIVATE","note":"Chưa thấy giao dịch"}', StatusType: 'PAYMENT' }, false), 'Chưa thấy giao dịch');
  assert.equal(safeNote({ Note: 'D04 broken' }, false), null);
  assert.equal(safeNote({ Note: 'D04 {"note":{"PasswordHash":"PRIVATE"}}' }, false), null);
  assert.equal(safeNote({ Note: 'Secret ' + 'a'.repeat(64) }, false), 'Đã ẩn nội dung bảo mật.');
  assert.equal(safeNote({ Note: 'Biên lai: /api/v1/uploads/p.png', StatusType: 'PAYMENT', StatusValue: 'REPORTED' }, false), 'Người mua đã gửi biên lai chuyển khoản.');
});
test('D05 actual router production JWT/demo scoped; dev header denied, no identity spoofing, HTTP 403/404', async t => {
  const app = require('../src/app'), models = require('../src/models'), actual = require('../src/repositories/D05_TheoDoiDonHang/tracking.repository');
  const f = fixture(), original = { ...actual }, findUser = models.Users.findByPk;
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'], env = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '1', JWT_SECRET: 'd05-unit-only' }); Object.assign(actual, f.repository);
  models.Users.findByPk = async id => ({ UserId: Number(id), Status: 'ACTIVE', FullName: 'Fixture', Roles: [{ RoleName: Number(id) === 2 ? 'ADMIN' : 'USER' }] });
  const token = id => { const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url'); const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 60 })}`; return `${data}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url')}`; };
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { Object.assign(actual, original); models.Users.findByPk = findUser; for (const key of keys) if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const root = `http://127.0.0.1:${server.address().port}/api/v1`, marker = { 'x-d01-demo': 'true' };
  for (const headers of [{}, { 'x-user-id': '1' }, { authorization: 'Bearer invalid', ...marker }]) assert.equal((await fetch(`${root}/orders/91/tracking`, { headers })).status, 401);
  const response = await fetch(`${root}/orders/91/tracking`, { headers: marker }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/); assert.equal((await response.json()).data.viewer.userId, 1);
  assert.equal((await fetch(`${root}/orders`, { headers: marker })).status, 200);
  assert.equal((await fetch(`${root}/orders?BuyerId=3`, { headers: marker })).status, 400);
  assert.equal((await fetch(`${root}/orders/92/tracking`, { headers: marker })).status, 404);
  assert.equal((await fetch(`${root}/orders/91/tracking`, { headers: { authorization: `Bearer ${token(2)}` } })).status, 403);
  assert.equal((await fetch(`${root}/orders/91/tracking`, { headers: { authorization: `Bearer ${token(1)}` } })).status, 200);
  for (const endpoint of ['/me', '/admin/users', '/seller/orders/91/payment']) assert.equal((await fetch(root + endpoint, { headers: marker })).status, 401);
  process.env.D01_DEMO_MODE = 'false'; assert.equal((await fetch(`${root}/orders/91/tracking`, { headers: marker })).status, 401);
});
