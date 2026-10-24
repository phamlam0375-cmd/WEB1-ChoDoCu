'use strict';
// Opt-in, chỉ container API local có source bind mount đã được caller kiểm tra.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { sequelize, Users, Roles, UserRoles, Store, Categories, Listings, Orders, Payments, RefundRequests, Commissions, StatusHistories, Notifications } = require('../../src/models');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
const { getSettingAt } = require('../../src/services/settings.service');
const repo = require('../../src/repositories/D06_XacNhanNhanHang/receipt.repository');
const { createReceiptService } = require('../../src/services/D06_XacNhanNhanHang/receipt.service');
if (process.env.LOCAL_D06_TEST !== 'true' || !process.env.EXPECTED_LOCAL_DB_UUID) throw new Error('Local D06 guard required');
const run = `D06Local_${Date.now().toString(36)}`;
const base = 'http://127.0.0.1:3000/api';
async function request(path, token, method = 'GET', body, extra = {}) {
  const headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function main() {
  const { password } = JSON.parse(fs.readFileSync(0, 'utf8')); assert.equal(typeof password, 'string'); assert(password.length >= 24);
  assert.equal(sequelize.config.host, 'mysql'); assert.equal(Number(sequelize.config.port), 3306); assert.equal(sequelize.config.database, 'cho_do_cu');
  const [[db]] = await sequelize.query('SELECT @@server_uuid AS uuid, DATABASE() AS db');
  assert.equal(db.uuid, process.env.EXPECTED_LOCAL_DB_UUID); assert.equal(db.db, 'cho_do_cu');
  const [migrations] = await sequelize.query("SELECT name FROM SequelizeMeta WHERE name = '20261016000100-add-delivery-verified-at.js'"); assert.equal(migrations.length, 1);
  assert.equal((await request('/health')).status, 200); assert(process.env.JWT_SECRET);
  const hash = await bcrypt.hash(password, 10), accounts = {}, tokens = {};
  const category = await Categories.findOne({ where: { Status: 'ACTIVE' } }); assert(category);
  for (const [name, role] of [['buyer', 'USER'], ['seller', 'SELLER'], ['other', 'USER'], ['driver', 'DRIVER']]) {
    const dbRole = await Roles.findOne({ where: { RoleName: role } }); assert(dbRole);
    const user = await sequelize.transaction(async transaction => {
      const row = await Users.create({ Username: `${run}_${name}`, FullName: `D06 local ${name}`, Email: `${run}_${name}@example.invalid`, PasswordHash: hash, EmailVerified: true, Status: 'ACTIVE' }, { transaction });
      await UserRoles.create({ UserId: row.UserId, RoleId: dbRole.RoleId }, { transaction }); return row;
    });
    accounts[name] = { id: user.UserId, email: user.Email };
    const login = await request('/auth/login', null, 'POST', { email: user.Email, password }); assert.equal(login.status, 200); assert(login.body.token); tokens[name] = login.body.token;
  }
  assert.equal((await request('/auth/login', null, 'POST', { email: accounts.buyer.email, password: crypto.randomBytes(32).toString('hex') })).status, 401);
  const store = await Store.create({ OwnerId: accounts.seller.id, StoreName: run, Address: 'Local fixture', Status: 'ACTIVE', BankName: 'LOCAL TEST BANK', BankAccountNumber: '000123456789', BankAccountHolder: 'D06 LOCAL SELLER' });
  async function fixture(label, d04 = false) {
    const listing = await Listings.create({ SellerId: accounts.seller.id, StoreId: store.StoreId, CategoryId: category.CategoryId, Title: `${run} ${label}`, Description: 'Isolated D06 fixture; no real delivery or bank transfer', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'RESERVED' });
    const order = await Orders.create({ BuyerId: accounts.buyer.id, SellerId: accounts.seller.id, ListingId: listing.ListingId, DeliveryMethod: 'DELIVERY', ReceiverName: 'D06 local receiver', ReceiverPhone: '0901234567', ReceiverAddress: 'Local fixture', ProductAmount: '123456.10', DeliveryFee: '25000.00', TotalAmount: '148456.10', CommissionRate: '2.50', Status: d04 ? 'WAITING_PAYMENT' : 'DELIVERED', ReservedUntil: new Date(Date.now() + 900000) });
    if (d04) {
      const form = new FormData(); form.append('proof', new Blob([pngReceipt()], { type: 'image/png' }), 'd06-local.png'); form.append('amount', '123456.10');
      assert.equal((await request(`/v1/orders/${order.OrderId}/payment-notice`, tokens.buyer, 'POST', form)).status, 200);
      const detail = await request(`/v1/seller/orders/${order.OrderId}/payment`, tokens.seller); assert.equal(detail.status, 200);
      assert.equal((await request(`/v1/seller/orders/${order.OrderId}/payment`, tokens.seller, 'PATCH', { action: 'CONFIRM', reportVersion: detail.body.data.reportVersion, note: 'D06 fixture only; no bank transfer' })).status, 200);
      assert.equal((await Orders.findByPk(order.OrderId)).Status, 'PAID');
      await order.update({ Status: 'DELIVERED' });
    } else {
      await Payments.create({ OrderId: order.OrderId, PayerId: accounts.buyer.id, PayeeId: accounts.seller.id, Amount: '123456.10', Status: 'CONFIRMED', ConfirmedBy: accounts.seller.id, ConfirmedAt: new Date(), ReportedAt: new Date(), ProofUrl: '/api/v1/uploads/d06-fixture.png', TransferContent: `D06 ${order.OrderId}`, BankName: 'LOCAL TEST BANK', BankAccountSnapshot: '000123456789', BankAccountHolderSnapshot: 'D06 LOCAL SELLER' });
    }
    // D13 chưa có: chỉ tạo bằng chứng hợp lệ cho đơn fixture mới, không giả endpoint runtime.
    await sequelize.query("INSERT INTO Deliveries (OrderId,DriverId,PickupAddress,DeliveryAddress,DriverFee,Status,VerifiedAt,DeliveredAt,ProofUrl) VALUES (:order,:driver,'Local pickup','Local destination',25000,'DELIVERED',NOW(),NOW(),'/api/v1/uploads/d06-delivery-fixture.png')", { replacements: { order: order.OrderId, driver: accounts.driver.id } });
    return order;
  }
  const happy = await fixture('real D03 D04 then D13 fixture', true), id = happy.OrderId;
  const endpoint = n => `/v1/orders/${n}/received`;
  const preview = n => `/v1/orders/${n}/received-preview`;
  for (const extra of [{}, { 'x-user-id': String(accounts.buyer.id) }, { 'x-d01-demo': 'true' }, { authorization: 'Bearer invalid', 'x-user-id': String(accounts.buyer.id) }]) {
    assert.equal((await request(endpoint(id), null, 'PATCH', { received: true }, extra)).status, 401);
    assert.equal((await request(preview(id), null, 'GET', undefined, extra)).status, 401);
  }
  for (const name of ['seller', 'driver', 'other']) assert.equal((await request(endpoint(id), tokens[name], 'PATCH', { received: true })).status, 403);
  for (const invalid of ['abc', '0', '-1', '1.5']) assert.equal((await request(endpoint(invalid), tokens.buyer, 'PATCH', { received: true })).status, 400);
  assert.equal((await request(preview('4294967295'), tokens.buyer)).status, 404);
  for (const body of [{}, { received: false }, { received: 'true' }, { received: true, BuyerId: accounts.other.id }, { received: true, Status: 'COMPLETED', CompletedAt: new Date() }]) assert.equal((await request(endpoint(id), tokens.buyer, 'PATCH', body)).status, 400);
  const counts = async n => Promise.all([StatusHistories.count({ where: { OrderId: n, StatusType: 'ORDER', StatusValue: 'COMPLETED' } }), Commissions.count({ where: { OrderId: n } }), Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: n, Title: `Đơn #${n} đã hoàn tất` } })]);
  assert.deepEqual(await counts(id), [0, 0, 0]); const p = await request(preview(id), tokens.buyer); assert.equal(p.status, 200); assert.equal(p.body.data.policy.canConfirm, true); assert.deepEqual(await counts(id), [0, 0, 0]);
  const results = await Promise.all([request(endpoint(id), tokens.buyer, 'PATCH', { received: true }), request(endpoint(id), tokens.buyer, 'PATCH', { received: true })]);
  assert.deepEqual(results.map(r => r.status), [200, 200]); assert.equal(results.filter(r => r.body.data.alreadyCompleted).length, 1);
  assert.deepEqual(await counts(id), [1, 1, 2]); const completed = await Orders.findByPk(id); assert.equal(completed.Status, 'COMPLETED'); assert(completed.CompletedAt);
  const history = await StatusHistories.findOne({ where: { OrderId: id, StatusValue: 'COMPLETED' } }); assert.equal(history.ChangedBy, accounts.buyer.id);
  assert.equal((await Listings.findByPk(completed.ListingId)).Status, 'SOLD');
  const commission = await Commissions.findOne({ where: { OrderId: id } }); assert.equal(Number(commission.OriginalAmount), 3086); assert.equal(commission.Status, 'UNPAID'); assert.equal(Number(commission.Rate), 2.5);
  const repeat = await request(endpoint(id), tokens.buyer, 'PATCH', { received: true }); assert.equal(repeat.status, 200); assert.equal(new Date(repeat.body.data.completedAt).getTime(), completed.CompletedAt.getTime()); assert.deepEqual(await counts(id), [1, 1, 2]);
  const tracking = await request(`/v1/orders/${id}/tracking`, tokens.buyer); assert.equal(tracking.status, 200); assert.equal(tracking.body.data.orderStatus, 'COMPLETED'); assert.equal(tracking.body.data.capabilities.receive.enabled, false);
  for (const variant of ['PAID', 'IN_DELIVERY', 'CANCELLED', 'REFUND_PENDING', 'PICKUP', 'unverified', 'payment', 'refund']) {
    const order = await fixture(variant), n = order.OrderId;
    if (variant === 'PICKUP') await order.update({ DeliveryMethod: 'PICKUP' });
    else if (variant === 'unverified') await sequelize.query('UPDATE Deliveries SET VerifiedAt = NULL WHERE OrderId = :n', { replacements: { n } });
    else if (variant === 'payment') await Payments.update({ Status: 'REPORTED', ConfirmedAt: null, ConfirmedBy: null }, { where: { OrderId: n } });
    else if (variant === 'refund') await RefundRequests.create({ OrderId: n, RequestedBy: accounts.buyer.id, Amount: '100000', Reason: 'Local D06 fixture', Status: 'PENDING' });
    else await order.update({ Status: variant });
    const blocked = await request(endpoint(n), tokens.buyer, 'PATCH', { received: true }); assert.equal(blocked.status, 409, variant + ': ' + JSON.stringify(blocked.body)); assert.deepEqual(await counts(n), [0, 0, 0]);
  }
  // Kiểm tra cơ chế tỷ lệ 0 của B08, không cài lại công thức vào runtime D06.
  const zero = await fixture('B08 zero fallback'); await zero.update({ CommissionRate: 0 });
  const expectedRate = await getSettingAt('COMMISSION_RATE', zero.CreatedAt);
  assert.equal((await request(endpoint(zero.OrderId), tokens.buyer, 'PATCH', { received: true })).status, 200);
  assert.equal(Number((await Commissions.findOne({ where: { OrderId: zero.OrderId } })).Rate), Number(expectedRate));
  // Fault injection chỉ trong process test, không thêm backdoor lên API.
  const rollback = await fixture('rollback notification');
  const service = createReceiptService({ repository: { ...repo, notifyUser: async () => { throw new Error('D06 rollback fixture'); } } });
  await assert.rejects(service.confirmReceived(rollback.OrderId, { received: true }, { UserId: accounts.buyer.id }), /D06 rollback fixture/);
  assert.equal((await Orders.findByPk(rollback.OrderId)).Status, 'DELIVERED'); assert.deepEqual(await counts(rollback.OrderId), [0, 0, 0]); assert.equal((await Listings.findByPk(rollback.ListingId)).Status, 'RESERVED');
  // B06 dùng chung ORDER mutex: đặt refund trong transaction giữ ORDER trước D06.
  const race = await fixture('B06 race'); let release, locked;
  const acquired = new Promise(resolve => { locked = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const refundTx = sequelize.transaction(async transaction => {
    await Orders.findByPk(race.OrderId, { transaction, lock: transaction.LOCK.UPDATE }); locked(); await gate;
    await RefundRequests.create({ OrderId: race.OrderId, RequestedBy: accounts.buyer.id, Amount: '100000', Reason: 'Local D06 race', Status: 'PENDING' }, { transaction });
    await Orders.update({ Status: 'REFUND_PENDING' }, { where: { OrderId: race.OrderId }, transaction });
  });
  await acquired;
  const concurrent = request(endpoint(race.OrderId), tokens.buyer, 'PATCH', { received: true }); release(); await refundTx;
  assert.equal((await concurrent).status, 409); assert.equal((await Orders.findByPk(race.OrderId)).Status, 'REFUND_PENDING'); assert.deepEqual(await counts(race.OrderId), [0, 0, 0]);
  // Chiều ngược lại: D06 giữ ORDER trước; B06 thật đọc trạng thái sau commit.
  const reverse = await fixture('D06 first then B06'); let orderHeld, unlock;
  const held = new Promise(resolve => { orderHeld = resolve; }), unlocked = new Promise(resolve => { unlock = resolve; });
  const heldService = createReceiptService({ repository: { ...repo, readOrder: async (...args) => { const row = await repo.readOrder(...args); orderHeld(); await unlocked; return row; } } });
  const completing = heldService.confirmReceived(reverse.OrderId, { received: true }, { UserId: accounts.buyer.id }); await held;
  const b06 = request(`/v1/orders/${reverse.OrderId}/refund-requests`, tokens.buyer, 'POST', { reason: 'Sản phẩm bị lỗi, hư hỏng', amount: 100000, refundBankCode: '970418', refundAccountNumber: '000123456789', refundAccountHolder: 'D06 LOCAL BUYER' });
  unlock(); await completing; const b06result = await b06; assert.equal(b06result.status, 201, JSON.stringify(b06result.body));
  assert.equal((await Orders.findByPk(reverse.OrderId)).Status, 'REFUND_PENDING'); assert.equal((await Commissions.count({ where: { OrderId: reverse.OrderId } })), 1);
  // B07 khóa REFUND -> ORDER: D06 đọc refund không khóa, không đảo thứ tự khóa.
  const b07order = await fixture('B07 lock order');
  const b07refund = await RefundRequests.create({ OrderId: b07order.OrderId, RequestedBy: accounts.buyer.id, Amount: '100000', Reason: 'Local D06 B07 lock', Status: 'PENDING' });
  let refundHeld, d06Held;
  const refundReady = new Promise(resolve => { refundHeld = resolve; }), d06Ready = new Promise(resolve => { d06Held = resolve; });
  const b07tx = sequelize.transaction(async transaction => {
    await RefundRequests.findByPk(b07refund.RefundRequestId, { transaction, lock: transaction.LOCK.UPDATE }); refundHeld(); await d06Ready;
    await Orders.findByPk(b07order.OrderId, { transaction, lock: transaction.LOCK.UPDATE });
  });
  await refundReady;
  const b07service = createReceiptService({ repository: { ...repo, readOrder: async (...args) => { const row = await repo.readOrder(...args); d06Held(); return row; } } });
  await assert.rejects(b07service.confirmReceived(b07order.OrderId, { received: true }, { UserId: accounts.buyer.id }), { code: 'REFUND_ACTIVE' }); await b07tx;
  const browser = await fixture('browser complete'), problem = await fixture('browser B06 problem');
  console.log(JSON.stringify({ pass: true, accounts, completed: id, browser: browser.OrderId, problem: problem.OrderId, fallbackRate: expectedRate, database: db.db, uuid: db.uuid }));
}
main().catch(error => { console.error('D06 local integration failed: ' + error.message); process.exitCode = 1; }).finally(() => sequelize.close());
