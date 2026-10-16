'use strict';
// Chạy từ container API LOCAL, nhận mật khẩu fixture qua stdin (không log/lưu file).
if (process.env.LOCAL_AUTH_TEST !== 'true' || !process.env.EXPECTED_LOCAL_DB_UUID) throw new Error('Local test guard required');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const bcrypt = require('bcrypt');
const { sequelize, Users, Roles, UserRoles, Store, Categories, Listings, Orders, StatusHistories, Payments } = require('../../src/models');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
const base = 'http://127.0.0.1:3000/api';
const run = 'AuthLocal_' + Date.now().toString(36);
async function request(path, token, method = 'GET', body, extra = {}) {
  const headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  assert.equal(typeof input.password, 'string'); assert(input.password.length >= 24);
  assert.equal(sequelize.config.host, 'mysql'); assert.equal(Number(sequelize.config.port), 3306); assert.equal(sequelize.config.database, 'cho_do_cu');
  const [[identity]] = await sequelize.query('SELECT @@server_uuid AS uuid, DATABASE() AS db');
  assert.equal(identity.uuid, process.env.EXPECTED_LOCAL_DB_UUID); assert.equal(identity.db, 'cho_do_cu');
  assert(process.env.JWT_SECRET, 'JWT must already be configured; test never generates/replaces runtime JWT secret');
  assert.equal((await request('/health')).status, 200);
  const category = await Categories.findOne({ where: { Status: 'ACTIVE' } }); assert(category);
  const accounts = {};
  const passwordHash = await bcrypt.hash(input.password, 10);
  for (const [name, role] of [['buyer', 'USER'], ['other', 'USER'], ['seller', 'SELLER'], ['driver', 'DRIVER']]) {
    const dbRole = await Roles.findOne({ where: { RoleName: role } }); assert(dbRole);
    const user = await sequelize.transaction(async transaction => {
      const account = await Users.create({ Username: `${run}_${name}`, FullName: `Auth local ${name}`, Email: `${run}_${name}@example.invalid`, PasswordHash: passwordHash, EmailVerified: true, Status: 'ACTIVE', Phone: null }, { transaction });
      await UserRoles.create({ UserId: account.UserId, RoleId: dbRole.RoleId }, { transaction }); return account;
    });
    accounts[name] = { id: user.UserId, email: user.Email };
  }
  const store = await Store.create({ OwnerId: accounts.seller.id, StoreName: run, Address: 'Local fixture only', Status: 'ACTIVE', BankName: 'LOCAL TEST BANK', BankAccountNumber: '000123456789', BankAccountHolder: 'LOCAL AUTH SELLER' });
  const tokens = {};
  for (const [name, account] of Object.entries(accounts)) {
    const login = await request('/auth/login', null, 'POST', { email: account.email, password: input.password });
    assert.equal(login.status, 200, `Real password login failed for ${name}`); assert(login.body.token);
    tokens[name] = login.body.token;
    const me = await request('/v1/me', tokens[name]); assert.equal(me.status, 200); assert.equal(me.body.data.UserId, account.id);
  }
  assert.equal((await request('/auth/login', null, 'POST', { email: accounts.buyer.email, password: crypto.randomBytes(32).toString('hex') })).status, 401);
  const product = async label => Listings.create({ SellerId: accounts.seller.id, StoreId: store.StoreId, CategoryId: category.CategoryId, Title: `${run} ${label}`, Description: 'Isolated local auth test; no real transfer or external notification', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
  const create = async label => {
    const listing = await product(label);
    const payload = { listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Local auth receiver', receiverPhone: '0901234567' };
    assert.equal((await request(`/v1/orders/preview/${listing.ListingId}`, tokens.buyer)).status, 200);
    assert.equal((await request('/v1/orders', tokens.buyer, 'POST', { ...payload, buyerId: accounts.other.id })).status, 422);
    const result = await request('/v1/orders', tokens.buyer, 'POST', payload, { 'x-user-id': String(accounts.other.id) });
    assert.equal(result.status, 201, 'D01 create failed');
    const row = await Orders.findByPk(result.body.data.orderId); assert.equal(row.BuyerId, accounts.buyer.id);
    return row;
  };
  const cancelled = await create('cancel');
  assert.equal((await request(`/v1/orders/${cancelled.OrderId}/cancel`, tokens.other, 'PATCH', { reason: 'Wrong owner' })).status, 403);
  assert.equal((await request(`/v1/orders/${cancelled.OrderId}/cancel`, tokens.buyer, 'PATCH', { reason: 'Local auth test cancellation' })).status, 200);
  const paid = await create('payment');
  // C06 chưa có trong source: chỉ chuẩn bị trạng thái cho ĐƠN FIXTURE MỚI này.
  await sequelize.transaction(async transaction => {
    await paid.update({ Status: 'WAITING_PAYMENT' }, { transaction });
    await StatusHistories.create({ OrderId: paid.OrderId, StatusType: 'ORDER', StatusValue: 'WAITING_PAYMENT', ChangedBy: accounts.seller.id, Note: 'Local auth fixture: seller acceptance prerequisite' }, { transaction });
  });
  const info = await request(`/v1/orders/${paid.OrderId}/payment-info`, tokens.buyer); assert.equal(info.status, 200); assert.equal(info.body.data.qr.imageUrl, null);
  assert.equal((await request(`/v1/orders/${paid.OrderId}/payment-info`, tokens.other)).status, 403);
  const report = async () => {
    const form = new FormData(); form.append('proof', new Blob([pngReceipt()], { type: 'image/png' }), 'local-receipt.png'); form.append('amount', paid.ProductAmount);
    assert.equal((await request(`/v1/orders/${paid.OrderId}/payment-notice`, tokens.buyer, 'POST', form)).status, 200);
  };
  await report();
  let detail = await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.seller); assert.equal(detail.status, 200);
  const rejected = { action: 'REJECT', reportVersion: detail.body.data.reportVersion, note: 'Local test; no real bank transfer' };
  assert.equal((await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.buyer, 'PATCH', rejected)).status, 403);
  assert.equal((await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.other)).status, 403);
  assert.equal((await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.seller, 'PATCH', rejected)).status, 200);
  await report(); detail = await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.seller);
  const confirmed = { action: 'CONFIRM', reportVersion: detail.body.data.reportVersion, note: 'Local fixture only; no real transfer' };
  assert.equal((await request(`/v1/seller/orders/${paid.OrderId}/payment`, tokens.seller, 'PATCH', confirmed)).status, 200);
  assert.equal((await Orders.findByPk(paid.OrderId)).Status, 'PAID');
  assert.equal((await Payments.findOne({ where: { OrderId: paid.OrderId } })).ConfirmedBy, accounts.seller.id);
  const history = await StatusHistories.findAll({ where: { OrderId: paid.OrderId } });
  assert(history.filter(row => row.StatusType === 'PAYMENT' && row.StatusValue === 'REPORTED').every(row => row.ChangedBy === accounts.buyer.id));
  assert(history.filter(row => row.StatusType === 'PAYMENT' && ['REJECTED', 'CONFIRMED'].includes(row.StatusValue)).every(row => row.ChangedBy === accounts.seller.id));
  const list = await request('/v1/orders?limit=100', tokens.buyer); assert.equal(list.status, 200); assert(list.body.data.some(row => row.orderId === paid.OrderId));
  const others = await request('/v1/orders', tokens.other); assert.equal(others.status, 200); assert.equal(others.body.data.length, 0);
  assert.equal((await request(`/v1/orders/${paid.OrderId}/tracking`, tokens.other)).status, 403);
  assert.equal((await request(`/v1/orders/${paid.OrderId}/tracking`, tokens.buyer, 'GET', undefined, { 'x-user-id': String(accounts.other.id) })).status, 200);
  const transportListing = await product('delivery fixture');
  const transport = await Orders.create({ BuyerId: accounts.buyer.id, SellerId: accounts.seller.id, ListingId: transportListing.ListingId, DeliveryMethod: 'DELIVERY', ReceiverName: 'Local auth delivery', ReceiverPhone: '0901234567', ReceiverAddress: 'Local fixture', ProductAmount: '123456.10', DeliveryFee: '25000.00', TotalAmount: '148456.10', Status: 'IN_DELIVERY', ReservedUntil: new Date(Date.now() + 900000) });
  await sequelize.query("INSERT INTO Deliveries (OrderId,DriverId,PickupAddress,DeliveryAddress,DriverFee,Status) VALUES (:order,:driver,'Local pickup','Local destination',25000,'DELIVERING')", { replacements: { order: transport.OrderId, driver: accounts.driver.id } });
  const driver = await request(`/v1/orders/${transport.OrderId}/tracking`, tokens.driver); assert.equal(driver.status, 200); assert.equal(driver.body.data.viewer.role, 'DRIVER'); assert.equal(driver.body.data.productAmount, undefined);
  assert.equal((await request(`/v1/orders/${paid.OrderId}/tracking`, tokens.driver)).status, 403);
  const count = () => Promise.all([Orders.count(), Payments.count(), StatusHistories.count()]); const before = await count();
  await request(`/v1/orders/${paid.OrderId}/tracking`, tokens.buyer); await request(`/v1/orders/${paid.OrderId}/tracking`, tokens.seller); assert.deepEqual(await count(), before);
  for (const path of ['/v1/orders', `/v1/orders/${paid.OrderId}/tracking`, `/v1/seller/orders/${paid.OrderId}/payment`]) for (const headers of [{}, { 'x-user-id': String(accounts.buyer.id) }, { 'x-d01-demo': 'true' }, { authorization: 'Bearer invalid', 'x-user-id': String(accounts.buyer.id) }]) assert.equal((await request(path, null, 'GET', undefined, headers)).status, 401);
  for (const path of ['/v1/reports', '/v1/refund-requests', '/v1/seller/commissions']) assert.equal((await request(path, path.includes('seller') ? tokens.seller : tokens.buyer)).status, 200);
  const browserProduct = await product('browser create');
  // Không trả mật khẩu/hash/token; chỉ metadata fixture phục vụ browser test kế tiếp.
  console.log(JSON.stringify({ pass: true, accounts, cancelled: cancelled.OrderId, paid: paid.OrderId, transport: transport.OrderId, listing: browserProduct.ListingId, sellerId: accounts.seller.id }));
}
main().catch(error => { console.error('Local auth integration failed: ' + error.message); process.exitCode = 1; }).finally(() => sequelize.close());
