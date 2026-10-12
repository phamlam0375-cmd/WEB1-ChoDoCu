'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPaymentService } = require('../src/services/D03_ThanhToan/payment.service');
const v = require('../src/validators/D03_ThanhToan/payment.validator');
const { pngReceipt, jpgReceipt } = require('./D03_ThanhToan/fixtures');
const buyer = { UserId: 71 };
const file = () => ({ buffer: pngReceipt(), mimetype: 'image/png' });

function fixture() {
  const state = {
    order: { OrderId: 91, BuyerId: 71, SellerId: 82, ListingId: 42, Status: 'WAITING_PAYMENT', ProductAmount: '123456.10', DeliveryFee: '23000.00', TotalAmount: '146456.10' },
    listing: { Title: 'D03 Fixture' }, seller: { UserId: 82, FullName: 'Seller', Status: 'ACTIVE' },
    store: { StoreId: 31, StoreName: 'Store', Status: 'ACTIVE', BankName: 'Test Bank', BankAccountNumber: '0001234567', BankAccountHolder: 'TEST SELLER', QrImageUrl: '/must-not-use.png' },
    payment: null, deliveries: [], refund: null, histories: [], notifications: [], saved: [], removed: [],
  };
  let queue = Promise.resolve();
  const repository = {
    async withTransaction(work) {
      const previous = queue; let release; queue = new Promise(resolve => { release = resolve; }); await previous;
      const snapshot = structuredClone({ ...state, saved: [], removed: [] });
      try { return await work({}); }
      catch (error) { Object.assign(state, { ...snapshot, saved: state.saved, removed: state.removed }); throw error; }
      finally { release(); }
    },
    async readState(id) { return state.order && id === state.order.OrderId ? state : null; },
    async createPayment(data) { state.payment = { PaymentId: 11, ...data }; return state.payment; },
    async reportPayment(_payment, changes) { Object.assign(state.payment, changes); return 1; },
    async createHistory(data) { state.histories.push(data); },
    async notifySeller(id, data) { state.notifications.push({ id, ...data }); },
  };
  const storage = { async save() { const saved = { url: `/api/v1/uploads/d03-test-${state.saved.length}.png` }; state.saved.push(saved); return saved; }, async remove(saved) { state.removed.push(saved); } };
  return { state, repository, service: createPaymentService({ repository, storage, clock: () => new Date('2026-10-12T00:00:00Z') }) };
}

test('D03 GET QR null, tiền tách biệt, snapshot ổn định; không báo/chuyển trạng thái khi mở', async () => {
  const f = fixture(); const info = await f.service.getPaymentInfo(91, buyer);
  assert.equal(info.policy.canReport, true); assert.equal(info.qr.imageUrl, null); assert.equal(info.qr.sellerId, 82);
  assert.equal(info.sellerAmount, '123456.10'); assert.equal(info.deliveryFee, '23000.00'); assert.equal(info.totalAmount, '146456.10');
  assert.equal(f.state.payment.Status, 'WAITING'); assert.equal(f.state.order.Status, 'WAITING_PAYMENT');
  f.state.store.BankAccountNumber = '999999'; f.state.store.BankAccountHolder = 'NEW HOLDER';
  const repeated = await f.service.getPaymentInfo(91, buyer);
  assert.deepEqual(repeated.bank, info.bank); assert.equal(repeated.transferContent, 'THANH TOAN DON 91');
  assert.equal(f.state.histories.length, 0); assert.equal(f.state.notifications.length, 0);
});

test('D03 RESERVED chờ C06, thiếu ngân hàng vẫn đọc đơn nhưng không tạo payment hoặc nhận báo', async () => {
  for (const variant of ['RESERVED', 'BANK', 'HOLDER', 'INVALID_ACCOUNT', 'STORE']) {
    const f = fixture();
    if (variant === 'RESERVED') f.state.order.Status = 'RESERVED';
    else if (variant === 'BANK') f.state.store.BankName = null;
    else if (variant === 'HOLDER') f.state.store.BankAccountHolder = '';
    else if (variant === 'STORE') f.state.store.Status = 'INACTIVE';
    else f.state.store.BankAccountNumber = 'abc';
    assert.equal((await f.service.getPaymentInfo(91, buyer)).policy.canReport, false);
    await assert.rejects(f.service.reportPayment(91, {}, file(), buyer), { status: 409 });
    assert.equal(f.state.payment, null); assert.equal(f.state.saved.length, 0);
  }
});

test('D03 quyền: chỉ người mua, không seller/admin, thiếu phiên 401/đơn mất 404', async () => {
  const f = fixture();
  for (const user of [null, { UserId: 82 }, { UserId: 2, roles: ['ADMIN'] }]) {
    await assert.rejects(f.service.getPaymentInfo(91, user), { status: user ? 403 : 401 });
    await assert.rejects(f.service.reportPayment(91, {}, file(), user), { status: user ? 403 : 401 });
  }
  await assert.rejects(f.service.getPaymentInfo(99, buyer), { status: 404 });
});

test('D03 biên lai thật PNG/JPG; từ chối giả magic, cắt cụt, CRC sai, rỗng/quá 5MB', () => {
  assert.equal(v.validateProof(file()), 'png'); assert.equal(v.validateProof({ buffer: jpgReceipt(), mimetype: 'image/png' }), 'jpg');
  const corrupt = pngReceipt(); corrupt[20] ^= 1;
  for (const buffer of [Buffer.from('89504e470d0a1a0a000000000000', 'hex'), Buffer.from('ffd8ff' + '00'.repeat(12), 'hex'), pngReceipt().subarray(0, 30), jpgReceipt().subarray(0, 50), corrupt, Buffer.alloc(5 * 1024 * 1024 + 1)]) assert.throws(() => v.validateProof({ buffer }), { status: 400 });
  assert.throws(() => v.validateProof(null), /Vui lòng tải ảnh biên lai/);
});

test('D03 validation ID/body; tiền chính xác BigInt, không tin Payee/amount/status/ProofUrl', async () => {
  for (const id of [0, -1, '1e2', 'NaN', '1.5', 4294967296]) assert.throws(() => v.validateOrderId(id), { status: 400 });
  for (const body of [{ proofUrl: '/uploads/a.png' }, { payeeId: 82 }, { status: 'CONFIRMED' }, { amount: 123456.1 }, { amount: '0.001' }]) assert.throws(() => v.validateNotice(body), { status: 400 });
  assert.equal(v.matchesAmount('9999999999999999.99', '9999999999999999.99'), true);
  assert.equal(v.matchesAmount('9999999999999999.98', '9999999999999999.99'), false);
  const f = fixture(); await assert.rejects(f.service.reportPayment(91, { amount: '146456.10' }, file(), buyer), { code: 'PAYMENT_AMOUNT_MISMATCH' });
  assert.equal(f.state.payment, null);
});

test('D03 báo thành công chỉ REPORTED; lưu đúng snapshot, history PAYMENT và thông báo seller', async () => {
  const f = fixture(); const result = await f.service.reportPayment(91, { amount: '123456.10' }, file(), buyer);
  assert.equal(result.data.paymentStatus, 'REPORTED'); assert.equal(f.state.order.Status, 'WAITING_PAYMENT');
  assert.equal(f.state.payment.PayeeId, 82); assert.equal(f.state.payment.PayerId, 71); assert.equal(f.state.payment.Amount, '123456.10');
  assert.equal(f.state.payment.ConfirmedAt, null); assert.equal(f.state.payment.ConfirmedBy, null); assert.ok(f.state.payment.ReportedAt);
  assert.equal(f.state.histories[0].StatusType, 'PAYMENT'); assert.equal(f.state.histories[0].StatusValue, 'REPORTED'); assert.equal(f.state.histories[0].ChangedBy, 71);
  assert.equal(f.state.notifications[0].id, 82); assert.equal(f.state.notifications[0].type, 'PAYMENT');
  assert.equal(f.state.notifications[0].referenceId, 91);
});

test('D03 lặp/đồng thời: một payment/history/notification/file, không ghi đè biên lai đầu', async () => {
  const f = fixture(); const results = await Promise.all([f.service.reportPayment(91, {}, file(), buyer), f.service.reportPayment(91, {}, file(), buyer)]);
  assert.equal(results.filter(r => !r.data.alreadyReported).length, 1);
  assert.equal(f.state.saved.length, 1); assert.equal(f.state.histories.length, 1); assert.equal(f.state.notifications.length, 1);
  const payment = structuredClone(f.state.payment); await f.service.reportPayment(91, {}, file(), buyer); assert.deepEqual(f.state.payment, payment);
});

test('D03 báo lại REJECTED trên cùng payment, giữ người nhận/số tiền/nội dung và metadata D04', async () => {
  const f = fixture(); await f.service.reportPayment(91, {}, file(), buyer);
  const prior = { ...f.state.payment }; f.state.payment.Status = 'REJECTED'; f.state.payment.ConfirmedBy = 82;
  f.state.store.BankAccountNumber = '999';
  await f.service.reportPayment(91, {}, file(), buyer);
  assert.equal(f.state.payment.PaymentId, prior.PaymentId); assert.equal(f.state.payment.BankAccountSnapshot, prior.BankAccountSnapshot);
  assert.equal(f.state.payment.TransferContent, prior.TransferContent); assert.equal(f.state.payment.ConfirmedBy, 82);
  assert.equal(f.state.histories.length, 2); assert.equal(f.state.notifications.length, 2);
});

test('D03 chặn CANCELLED/paid/refund/CONFIRMED/delivery, không đổi dữ liệu', async () => {
  for (const status of ['CANCELLED', 'PAID', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'REFUND_PENDING', 'REFUNDED', 'UNKNOWN']) {
    const f = fixture(); f.state.order.Status = status;
    await assert.rejects(f.service.reportPayment(91, {}, file(), buyer), { status: 409 });
    assert.equal(f.state.saved.length, 0); assert.equal(f.state.order.Status, status);
  }
  for (const property of ['confirmed', 'refund', 'delivery']) {
    const f = fixture(); await f.service.getPaymentInfo(91, buyer);
    if (property === 'confirmed') f.state.payment.Status = 'CONFIRMED';
    if (property === 'refund') f.state.refund = { Status: 'PENDING' };
    if (property === 'delivery') f.state.deliveries.push({ DeliveryId: 1 });
    await assert.rejects(f.service.reportPayment(91, {}, file(), buyer), { status: 409 });
    assert.equal(f.state.saved.length, 0);
  }
});

test('D03 dữ liệu payment cũ sai/thiếu snapshot không bị âm thầm thay tài khoản', async () => {
  for (const key of ['PayerId', 'PayeeId', 'Amount', 'BankAccountHolderSnapshot', 'Status']) {
    const f = fixture(); await f.service.getPaymentInfo(91, buyer);
    f.state.payment[key] = key === 'Status' ? 'UNKNOWN' : key === 'BankAccountHolderSnapshot' ? null : 999;
    await assert.rejects(f.service.reportPayment(91, {}, file(), buyer), { status: 409 });
    assert.equal(f.state.saved.length, 0);
  }
});

test('D03 lỗi notification/conditional update rollback cả SQL và dọn file riêng', async () => {
  for (const failure of ['notify', 'update']) {
    const f = fixture();
    if (failure === 'notify') f.repository.notifySeller = async () => { throw new Error('notify failed'); };
    else f.repository.reportPayment = async () => 0;
    await assert.rejects(f.service.reportPayment(91, {}, file(), buyer));
    assert.equal(f.state.payment, null); assert.equal(f.state.histories.length, 0); assert.equal(f.state.removed.length, 1);
  }
});

test('D03 deadlock/timeout trả 409 để tải lại, không báo thành công giả', async () => {
  const f = fixture(); f.repository.withTransaction = async () => { throw { original: { code: 'ER_LOCK_DEADLOCK' } }; };
  await assert.rejects(f.service.getPaymentInfo(91, buyer), { status: 409, code: 'PAYMENT_CONFLICT' });
});

test('D03 router/controller thật: demo production scoped, GET đúng contract; auth trước upload; không giả URL/biên lai', async t => {
  const app = require('../src/app'), models = require('../src/models');
  const actual = require('../src/repositories/D03_ThanhToan/payment.repository');
  const f = fixture(), original = { ...actual }, findUser = models.Users.findByPk;
  const envKeys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'];
  const priorEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '71', JWT_SECRET: 'D03-route-test-only-secret-not-a-real-token' });
  Object.assign(actual, f.repository);
  models.Users.findByPk = async id => ({ UserId: Number(id), FullName: 'Fixture buyer', Status: 'ACTIVE', Roles: [{ RoleName: 'USER' }] });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    Object.assign(actual, original); models.Users.findByPk = findUser;
    for (const key of envKeys) if (priorEnv[key] === undefined) delete process.env[key]; else process.env[key] = priorEnv[key];
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/v1`;
  const demo = { 'x-d01-demo': 'true' };
  let response = await fetch(`${url}/orders/91/payment-info`, { headers: demo });
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.data.qr.imageUrl, null); assert.equal(body.data.productAmount, '123456.10');
  for (const headers of [{}, { 'x-user-id': '71' }, { ...demo, authorization: 'Bearer invalid' }]) {
    assert.equal((await fetch(`${url}/orders/91/payment-info`, { headers })).status, 401);
    assert.equal((await fetch(`${url}/orders/91/payment-notice`, { method: 'POST', headers, body: 'no proof' })).status, 401);
  }
  assert.equal((await fetch(`${url}/orders/99/payment-info`, { headers: demo })).status, 404);
  assert.equal((await fetch(`${url}/orders/abc/payment-info`, { headers: demo })).status, 400);
  f.state.order.BuyerId = 82; assert.equal((await fetch(`${url}/orders/91/payment-info`, { headers: demo })).status, 403); f.state.order.BuyerId = 71;
  assert.equal((await fetch(`${url}/me`, { headers: demo })).status, 401);
  const forged = new FormData(); forged.append('proof', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  assert.equal((await fetch(`${url}/orders/91/payment-notice`, { method: 'POST', headers: demo, body: forged })).status, 400);
  response = await fetch(`${url}/orders/91/payment-notice`, { method: 'POST', headers: { ...demo, 'Content-Type': 'application/json' }, body: JSON.stringify({ proofUrl: '/api/v1/uploads/fake.png' }) }); assert.equal(response.status, 400);
  assert.equal((await fetch(`${url}/orders/91/payment-notice`, { method: 'POST', headers: { ...demo, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  process.env.D01_DEMO_MODE = 'false'; assert.equal((await fetch(`${url}/orders/91/payment-info`, { headers: demo })).status, 401);
  assert.equal(f.state.saved.length, 0);
});
