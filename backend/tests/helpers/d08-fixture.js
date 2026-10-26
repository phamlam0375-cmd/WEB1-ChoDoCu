'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
// Phải kiểm tra trước khi import model; không chạy trong DB của nhóm hay CD.
const feature = process.env.D09_INTEGRATION_TEST === 'true' ? 'D09' : 'D08';
if (process.env.NODE_ENV !== 'test' || process.env[`${feature}_INTEGRATION_TEST`] !== 'true'
  || !new RegExp(`^cho_do_cu_${feature.toLowerCase()}_[a-z0-9_]+$`).test(process.env.DB_NAME || '') || !process.env[`${feature}_EXPECTED_MYSQL_UUID`]) throw new Error('Fixture chỉ dành cho database test riêng với UUID MySQL local đã xác minh.');
for (const key of ['EMAIL_USER', 'EMAIL_PASS', 'MAIL_USER', 'MAIL_PASS', 'SMTP_USER', 'SMTP_PASS']) process.env[key] = '';
const bcrypt = require('bcrypt');
const models = require('../../src/models');
const { sequelize, Users, Roles, UserRoles, PartnerApplications, DriverProfiles, Categories, Listings, Orders, Payments } = models;
const { createPreparedDelivery } = require('../../src/services/D07_TaiXeNhanChuyen/preparedDelivery.service');
const app = require('../../src/app');

async function createEnvironment({ browser = false } = {}) {
  const [[connection]] = await sequelize.query('SELECT DATABASE() AS db, @@server_uuid AS uuid');
  assert.equal(connection.db, `${process.env.DB_NAME}_test`); assert.equal(connection.uuid, process.env[`${feature}_EXPECTED_MYSQL_UUID`]);
  const prefix = browser ? process.env[`${feature}_BROWSER_PREFIX`] : `${feature.toLowerCase()}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  if (!new RegExp(`^${feature.toLowerCase()}_[a-z0-9_]{5,30}$`).test(prefix || '')) throw new Error('Fixture prefix không hợp lệ.');
  const password = browser ? process.env[`${feature}_BROWSER_TEST_PASSWORD`] : crypto.randomBytes(24).toString('base64url');
  if (typeof password !== 'string' || password.length < 20) throw new Error('Thiếu mật khẩu fixture ngẫu nhiên.');
  const server = app.listen(browser ? 3000 : 0, '0.0.0.0'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, tokens = new Map();
  const roles = {};
  for (const RoleName of ['USER', 'SELLER', 'DRIVER']) [roles[RoleName]] = await Roles.findOrCreate({ where: { RoleName } });
  let sequence = 0;
  async function request(path, { user, method = 'GET', body, file, headers = {}, raw = false, form } = {}) {
    let payload = form;
    if (file) {
      payload = new FormData(); for (const [key, value] of Object.entries(body || {})) payload.append(key, String(value));
      payload.append('proof', new Blob([file.buffer], { type: file.type || 'image/png' }), file.name || 'fixture.png');
    } else if (!payload && body !== undefined) payload = JSON.stringify(body);
    const response = await fetch(base + path, { method, headers: {
      ...(user ? { Authorization: `Bearer ${tokens.get(user.UserId)}` } : {}),
      ...(body !== undefined && !file && !form ? { 'content-type': 'application/json' } : {}), ...headers }, ...(payload !== undefined ? { body: payload } : {}) });
    return { status: response.status, headers: response.headers, body: raw ? Buffer.from(await response.arrayBuffer()) : await response.json() };
  }
  async function person(label = `u${++sequence}`, { driver = false, application = 'APPROVED', availability = 'AVAILABLE' } = {}) {
    const user = await Users.create({ Username: `${prefix}_${label}`, FullName: `${feature} fixture ${label}`, Email: `${prefix}_${label}@example.test`,
      PasswordHash: await bcrypt.hash(password, 4), EmailVerified: true, PhoneVerified: true, Status: 'ACTIVE' });
    if (driver) {
      await UserRoles.create({ UserId: user.UserId, RoleId: roles.DRIVER.RoleId });
      if (application) await PartnerApplications.create({ UserId: user.UserId, PartnerType: 'DRIVER', Status: application });
      await DriverProfiles.create({ UserId: user.UserId, VehicleType: 'MOTORBIKE', VehiclePlate: 'TEST', ServiceArea: 'AREA_1', AvailabilityStatus: availability });
    }
    const login = await request('/api/auth/login', { method: 'POST', body: { email: user.Email, password } });
    assert.equal(login.status, 200, 'Đăng nhập thật phải thành công'); tokens.set(user.UserId, login.body.token);
    return user;
  }
  const buyer = await person('buyer'), seller = await person('seller'), outsider = await person('outsider');
  const category = await Categories.create({ CategoryName: prefix, Status: 'ACTIVE' });
  async function trip({ driver: suppliedDriver, accept = true } = {}) {
    const driver = suppliedDriver || await person(undefined, { driver: true });
    const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: `${prefix}_item${++sequence}`, Description: 'Fixture chỉ trong database test D08', Price: '100000', ConditionLevel: 'GOOD', Status: 'RESERVED' });
    const order = await Orders.create({ BuyerId: buyer.UserId, SellerId: seller.UserId, ListingId: listing.ListingId, DeliveryMethod: 'DELIVERY', DeliveryFeeRuleId: 1,
      ReceiverName: 'D08 fixture', ReceiverPhone: '0900000111', ReceiverAddress: 'Địa chỉ fixture riêng', ProductAmount: '100000.00', DeliveryFee: '20000.01', TotalAmount: '120000.01',
      Status: 'PAID', ReservedUntil: new Date(Date.now() + 300000) });
    const confirmedAt = new Date(Math.floor(Date.now() / 1000) * 1000 - 120000);
    const payment = await Payments.create({ OrderId: order.OrderId, PayerId: buyer.UserId, PayeeId: seller.UserId, Amount: '100000', BankName: 'TEST BANK',
      BankAccountSnapshot: '1234567890', BankAccountHolderSnapshot: 'TEST', TransferContent: `TEST ${order.OrderId}`, ProofUrl: '/fixture.png',
      Status: 'CONFIRMED', ReportedAt: confirmedAt, ConfirmedAt: confirmedAt, ConfirmedBy: seller.UserId });
    const delivery = await sequelize.transaction(tx => createPreparedDelivery(order.OrderId, { sellerId: seller.UserId, readyAt: new Date(confirmedAt.getTime() + 1000), pickupAddress: 'Điểm lấy hàng fixture riêng' },
      { ruleId: 1, pickupArea: 'AREA_1', deliveryArea: 'AREA_1', vehicleType: 'MOTORBIKE', driverFee: order.DeliveryFee, routeDistanceKm: null }, tx));
    if (accept) {
      const accepted = await request(`/api/v1/driver/deliveries/${delivery.DeliveryId}/accept`, { user: driver, method: 'PATCH', body: {} });
      assert.equal(accepted.status, 200, 'Fixture phải nhận chuyến thật qua D07');
    }
    return { order, payment, deliveryId: delivery.DeliveryId, driver };
  }
  const issue = (t, user = seller) => request(`/api/v1/seller/orders/${t.order.OrderId}/pickup-code`, { user, method: 'POST', body: { handoverConfirmed: true } });
  const pickup = (t, code, { user = t.driver, file, body, headers } = {}) => request(`/api/v1/driver/deliveries/${t.deliveryId}/pickup`, {
    user, method: 'PATCH', body: body || { pickupCode: code, packageIntact: true }, file, headers });
  const read = async t => {
    const [[row]] = await sequelize.query('SELECT * FROM Deliveries WHERE DeliveryId = :id', { replacements: { id: t.deliveryId } }); return row;
  };
  const close = async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await sequelize.close(); };
  return { models, prefix, buyer, seller, outsider, person, trip, issue, pickup, request, read, close, server, connection };
}
module.exports = { createEnvironment };
