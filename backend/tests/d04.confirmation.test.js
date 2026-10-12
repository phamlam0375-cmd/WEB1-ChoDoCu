'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createConfirmationService, reportVersion } = require('../src/services/D04_XacNhanNhanTien/confirmation.service');
const v = require('../src/validators/D04_XacNhanNhanTien/confirmation.validator');
const seller = { UserId: 3, roles: ['SELLER'] };

function fixture() {
  let state = {
    order: { OrderId: 91, BuyerId: 1, SellerId: 3, ListingId: 42, Status: 'WAITING_PAYMENT', ProductAmount: '123456.10', DeliveryFee: '23000.00', TotalAmount: '146456.10', ReservedUntil: '2026-10-12T00:00:00Z' },
    payment: { PaymentId: 7, OrderId: 91, PayerId: 1, PayeeId: 3, Amount: '123456.10', Status: 'REPORTED', BankName: 'BANK SNAPSHOT', BankAccountSnapshot: '00123456', BankAccountHolderSnapshot: 'SELLER SNAPSHOT', TransferContent: 'THANH TOAN DON 91', ProofUrl: '/api/v1/uploads/d03-first.png', ReportedAt: new Date('2026-10-12T01:00:00Z'), ConfirmedBy: null, ConfirmedAt: null },
    listing: { ListingId: 42, Title: 'Fixture', Status: 'RESERVED' }, buyer: { UserId: 1, FullName: 'Buyer' },
    report: { HistoryId: 10 }, decision: null, refund: null, deliveries: [], histories: [], notifications: [],
  };
  let queue = Promise.resolve();
  const repository = {
    withTransaction(work) {
      const result = queue.then(async () => {
        const before = structuredClone(state);
        try { return await work({ LOCK: { UPDATE: 'UPDATE' } }); } catch (error) { state = before; throw error; }
      });
      queue = result.catch(() => {}); return result;
    },
    readState: async id => id === 91 ? state : null,
    list: async (id, params) => ({ count: 1, rows: [{ ...state.order, Buyer: state.buyer, Listing: state.listing, Payment: state.payment }], id, params }),
    decidePayment: async (_payment, changes) => { Object.assign(state.payment, changes); return 1; },
    markPaid: async () => { state.order.Status = 'PAID'; return 1; },
    createHistory: async data => { const row = { HistoryId: state.histories.length + 11, ...data }; state.histories.push(row); if (data.StatusType === 'PAYMENT') state.decision = row; return row; },
    notifyBuyer: async (id, data) => { state.notifications.push({ id, ...data }); },
  };
  return { get state() { return state; }, repository, service: createConfirmationService({ repository, clock: () => new Date('2026-10-12T01:05:00Z') }) };
}
const body = (f, action = 'CONFIRM', note = '') => ({ action, note, reportVersion: reportVersion(f.state) });

test('D04 xác nhận: PAID/CONFIRMED, snapshot/tiền/biên lai/thời hạn giữ nguyên, 2 lịch sử/1 thông báo; không tạo hoa hồng', async () => {
  const f = fixture(), p = structuredClone(f.state.payment), deadline = f.state.order.ReservedUntil;
  const result = await f.service.decide(91, body(f, 'CONFIRM', 'Đã đối chiếu ngân hàng'), seller);
  assert.equal(result.data.orderStatus, 'PAID'); assert.equal(result.data.paymentStatus, 'CONFIRMED');
  assert.equal(f.state.payment.ConfirmedBy, 3); assert.equal(f.state.payment.ConfirmedAt.toISOString(), '2026-10-12T01:05:00.000Z');
  for (const key of ['Amount', 'ProofUrl', 'BankName', 'BankAccountSnapshot', 'BankAccountHolderSnapshot', 'TransferContent', 'PayerId', 'PayeeId']) assert.equal(f.state.payment[key], p[key]);
  assert.equal(f.state.order.ReservedUntil, deadline); assert.equal(f.state.listing.Status, 'RESERVED');
  assert.deepEqual(f.state.histories.map(h => [h.StatusType, h.StatusValue]), [['PAYMENT', 'CONFIRMED'], ['ORDER', 'PAID']]);
  assert.equal(f.state.notifications.length, 1); assert.equal(f.state.notifications[0].id, 1);
  assert.equal(result.data.lastDecision.note, 'Đã đối chiếu ngân hàng');
});

test('D04 chưa nhận tiền: REJECTED, WAITING_PAYMENT, không ghi ConfirmedBy/At, không mở tin/đổi hạn, nhắc gửi lại D03 không chuyển lần nữa', async () => {
  const f = fixture(), before = structuredClone(f.state);
  const result = await f.service.decide(91, body(f, 'REJECT', 'Chưa thấy giao dịch'), seller);
  assert.equal(result.data.paymentStatus, 'REJECTED'); assert.equal(f.state.order.Status, 'WAITING_PAYMENT');
  assert.equal(f.state.payment.ConfirmedBy, null); assert.equal(f.state.payment.ConfirmedAt, null);
  assert.deepEqual(f.state.order, before.order); assert.deepEqual(f.state.listing, before.listing);
  assert.equal(f.state.payment.ProofUrl, before.payment.ProofUrl); assert.equal(f.state.histories.length, 1);
  assert.match(f.state.notifications[0].message, /không tự chuyển tiền lần nữa/);
});

test('D04 chỉ đúng chủ bán; buyer/seller khác/admin không có đặc quyền; thiếu phiên 401 và đơn mất 404', async () => {
  for (const user of [null, { UserId: 1 }, { UserId: 4 }, { UserId: 2, roles: ['ADMIN'] }]) {
    const f = fixture(); for (const call of [() => f.service.getDetail(91, user), () => f.service.decide(91, body(f), user)]) await assert.rejects(call(), { status: user ? 403 : 401 });
  }
  const f = fixture(); await assert.rejects(f.service.getDetail(92, seller), { status: 404 });
});

test('D04 từ chối payment thiếu/WAITING, sai payer/payee/amount, legacy thiếu snapshot/biên lai/thời điểm và dấu xác nhận bất thường', async () => {
  for (const key of ['missing', 'Status', 'PayerId', 'PayeeId', 'Amount', 'BankAccountHolderSnapshot', 'ProofUrl', 'ReportedAt', 'ConfirmedBy', 'ConfirmedAt']) {
    const f = fixture(), input = body(f);
    if (key === 'missing') f.state.payment = null;
    else f.state.payment[key] = key === 'Status' ? 'WAITING' : ['PayerId', 'PayeeId', 'Amount', 'ConfirmedBy'].includes(key) ? 999 : key === 'ConfirmedAt' ? new Date() : null;
    assert.equal((await f.service.getDetail(91, seller)).policy.canDecide, false);
    await assert.rejects(f.service.decide(91, input, seller), { status: 409 }); assert.equal(f.state.histories.length, 0);
  }
});

test('D04 không xử lý RESERVED/CANCELLED/REFUND_PENDING/REFUNDED/đang giao/hoàn tất/refund/delivery; không đảo CONFIRMED', async () => {
  for (const variant of ['RESERVED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'IN_DELIVERY', 'DELIVERING', 'DELIVERED', 'COMPLETED', 'refund', 'delivery', 'CONFIRMED']) {
    const f = fixture();
    if (variant === 'refund') f.state.refund = { Status: 'PENDING' };
    else if (variant === 'delivery') f.state.deliveries.push({ DeliveryId: 1 });
    else if (variant === 'CONFIRMED') { f.state.payment.Status = 'CONFIRMED'; f.state.order.Status = 'PAID'; }
    else f.state.order.Status = variant;
    await assert.rejects(f.service.decide(91, body(f, 'REJECT'), seller), { status: 409 }); assert.equal(f.state.histories.length, 0);
  }
});

test('D04 retry cùng quyết định không trùng; hai quyết định trái nhau chỉ một thắng; không đổi ConfirmedAt hay ghi chú', async () => {
  for (const action of ['CONFIRM', 'REJECT']) {
    const f = fixture(), input = body(f, action, 'note');
    const results = await Promise.all([f.service.decide(91, input, seller), f.service.decide(91, input, seller)]);
    assert.equal(results.filter(r => r.data.alreadyApplied).length, 1);
    const before = structuredClone(f.state); await f.service.decide(91, input, seller); assert.deepEqual(f.state, before);
    await assert.rejects(f.service.decide(91, { ...input, note: 'changed' }, seller), { code: 'PAYMENT_ALREADY_UPDATED' });
    await assert.rejects(f.service.decide(91, { ...input, action: action === 'CONFIRM' ? 'REJECT' : 'CONFIRM' }, seller), { code: 'PAYMENT_ALREADY_UPDATED' });
  }
  const f = fixture(), input = body(f);
  const results = await Promise.allSettled([f.service.decide(91, input, seller), f.service.decide(91, { ...input, action: 'REJECT' }, seller)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.state.notifications.length, 1);
});

test('D04 báo lại sau REJECTED: phiên mới ngay cả cùng timestamp/biên lai; tab cũ 409, phiên mới xác nhận được', async () => {
  const f = fixture(), old = body(f, 'REJECT'); await f.service.decide(91, old, seller);
  f.state.payment.Status = 'REPORTED'; f.state.report.HistoryId++;
  assert.notEqual(reportVersion(f.state), old.reportVersion);
  await assert.rejects(f.service.decide(91, { ...old, action: 'CONFIRM' }, seller), { code: 'PAYMENT_REPORT_CHANGED' });
  const result = await f.service.decide(91, body(f), seller); assert.equal(result.data.paymentStatus, 'CONFIRMED');
  assert.equal(f.state.notifications.length, 2);
});

test('D04 lỗi cập nhật/lịch sử/thông báo rollback toàn transaction; deadlock/timeout 409', async () => {
  for (const key of ['decidePayment', 'markPaid', 'createHistory', 'notifyBuyer']) {
    const f = fixture(), before = structuredClone(f.state);
    f.repository[key] = async () => { if (['decidePayment', 'markPaid'].includes(key)) return 0; throw new Error('SQL failure'); };
    await assert.rejects(f.service.decide(91, body(f), seller)); assert.deepEqual(f.state, before);
  }
  for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    const f = fixture(); f.repository.withTransaction = async () => { throw { original: { code } }; };
    await assert.rejects(f.service.decide(91, body(f), seller), { status: 409, code: 'PAYMENT_CONFLICT' });
  }
});

test('D04 validation chặn trạng thái/ID/quyền/tiền tùy ý; phân trang giới hạn và filter theo danh tính server', async () => {
  const f = fixture();
  for (const extra of [{ action: 'PAID' }, { reportVersion: '' }, { sellerId: 3 }, { status: 'PAID' }, { amount: 123456 }, { note: 'x'.repeat(251) }, { note: 1 }]) assert.throws(() => v.validateDecision({ ...body(f), ...extra }), { status: 400 });
  for (const id of ['abc', '1e2', 0, 4294967296]) assert.throws(() => v.validateOrderId(id), { status: 400 });
  for (const query of [{ status: 'PAID' }, { page: 'abc' }, { page: '9007199254740991' }, { limit: 0 }]) assert.throws(() => v.validateList(query), { status: 400 });
  let captured;
  f.repository.list = async (id, params) => { captured = { id, params }; return { count: 0, rows: [] }; };
  await f.service.listPayments({ sellerId: 999, status: 'ALL', limit: 999 }, seller);
  assert.equal(captured.id, 3); assert.equal(captured.params.limit, 100);
});

test('D04 router thật: JWT production, không nhận marker buyer/dev header; ownership cả GET/PATCH; JSON contract', async t => {
  const app = require('../src/app'), models = require('../src/models');
  const actual = require('../src/repositories/D04_XacNhanNhanTien/confirmation.repository');
  const f = fixture(), original = { ...actual }, findUser = models.Users.findByPk;
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'];
  const env = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '1', JWT_SECRET: 'D04-unit-test-only-not-a-real-secret' });
  Object.assign(actual, f.repository);
  models.Users.findByPk = async id => ({ UserId: Number(id), Status: 'ACTIVE', FullName: 'Fixture', Roles: [{ RoleName: Number(id) === 2 ? 'ADMIN' : Number(id) === 3 ? 'SELLER' : 'USER' }] });
  const token = id => {
    const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const data = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: id, exp: Math.floor(Date.now() / 1000) + 60 })}`;
    return `${data}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url')}`;
  };
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    Object.assign(actual, original); models.Users.findByPk = findUser;
    for (const key of keys) if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  });
  const root = `http://127.0.0.1:${server.address().port}/api/v1/seller/orders`;
  for (const headers of [{}, { 'x-user-id': '3' }, { 'x-d01-demo': 'true' }, { authorization: 'Bearer invalid', 'x-user-id': '3' }]) {
    assert.equal((await fetch(`${root}/91/payment`, { headers })).status, 401);
    assert.equal((await fetch(`${root}/91/payment`, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body(f)) })).status, 401);
  }
  for (const id of [1, 2, 4]) {
    const headers = { authorization: `Bearer ${token(id)}`, 'content-type': 'application/json' };
    assert.equal((await fetch(`${root}/91/payment`, { headers })).status, 403);
    assert.equal((await fetch(`${root}/91/payment`, { method: 'PATCH', headers, body: JSON.stringify(body(f)) })).status, 403);
  }
  const headers = { authorization: `Bearer ${token(3)}`, 'content-type': 'application/json' };
  const detail = await fetch(`${root}/91/payment`, { headers }); assert.equal(detail.status, 200); assert.match(detail.headers.get('cache-control'), /no-store/);
  assert.equal((await detail.json()).data.bank.accountHolder, 'SELLER SNAPSHOT');
  assert.equal((await fetch(`${root}/payments?limit=20`, { headers })).status, 200);
  assert.equal((await fetch(`${root}/91/payment`, { method: 'PATCH', headers, body: JSON.stringify(body(f)) })).status, 200);
});
