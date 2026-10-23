'use strict';

// Fixtures CHỈ trong database *_d07_*_test riêng; không tự duyệt/cấp quyền cho
// tài khoản của nhóm, không gọi SMTP, không xóa/reset dữ liệu sau khi kiểm tra.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.env.D07_INTEGRATION_TEST !== 'true' || process.env.NODE_ENV !== 'test'
    || !/^cho_do_cu_d07_[a-z0-9_]+$/.test(process.env.DB_NAME || '') || !process.env.D07_EXPECTED_MYSQL_UUID) {
  throw new Error('Chỉ chạy khi chủ động bật D07_INTEGRATION_TEST, NODE_ENV=test, DB_NAME=cho_do_cu_d07_<run> và UUID MySQL local đã xác minh.');
}
// Không gửi email/tin nhắn ra ngoài từ tiến trình kiểm thử này.
for (const key of ['EMAIL_USER', 'EMAIL_PASS', 'MAIL_USER', 'MAIL_PASS', 'SMTP_USER', 'SMTP_PASS']) process.env[key] = '';
process.env.AUTH_DEV_HEADER = 'true'; process.env.D01_DEMO_MODE = 'true';
const bcrypt = require('bcrypt');
const models = require('../src/models');
const { sequelize, Users, Roles, UserRoles, PartnerApplications, DriverProfiles, Categories, Listings, Orders, Payments, Deliveries, StatusHistories, Notifications, RefundRequests } = models;
const app = require('../src/app');
const repository = require('../src/repositories/D07_TaiXeNhanChuyen/assignment.repository');
const { createAssignmentService } = require('../src/services/D07_TaiXeNhanChuyen/assignment.service');
const { createPreparedDelivery } = require('../src/services/D07_TaiXeNhanChuyen/preparedDelivery.service');
const browserMode = process.env.D07_HEADLESS_SERVER === 'true';
const prefix = browserMode ? process.env.D07_BROWSER_PREFIX : `d07_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
if (!/^d07_[a-z0-9_]{5,30}$/.test(prefix || '')) throw new Error('Fixture prefix không hợp lệ.');
const password = browserMode ? process.env.D07_BROWSER_TEST_PASSWORD : crypto.randomBytes(24).toString('base64url');
if (typeof password !== 'string' || password.length < 20) throw new Error('Thiếu mật khẩu fixture ngẫu nhiên cho browser test.');
let server, base, completed = 0;
const checks = async (name, work) => { await work(); completed++; console.log(`PASS D07 ${completed}: ${name}`); };
const scalar = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements, type: require('sequelize').QueryTypes.SELECT }))[0];
const actor = user => ({ UserId: user.UserId, roles: ['DRIVER'] });
const tokens = new Map();
async function request(path, { user, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${tokens.get(user.UserId)}` } : {}),
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() };
}
async function person(label, { application = 'APPROVED', driver = true, profile = true, availability = 'AVAILABLE', maxDistance = '20.00' } = {}) {
  const user = await Users.create({ Username: `${prefix}_${label}`, FullName: `Fixture ${label}`, Email: `${prefix}_${label}@example.test`,
    PasswordHash: await bcrypt.hash(password, 4), Status: 'ACTIVE', EmailVerified: true, PhoneVerified: true });
  if (driver) await UserRoles.create({ UserId: user.UserId, RoleId: (await Roles.findOne({ where: { RoleName: 'DRIVER' } })).RoleId });
  if (application) await PartnerApplications.create({ UserId: user.UserId, PartnerType: application === 'SELLER' ? 'SELLER' : 'DRIVER', Status: application === 'SELLER' ? 'APPROVED' : application });
  if (profile) await DriverProfiles.create({ UserId: user.UserId, VehicleType: 'MOTORBIKE', VehiclePlate: 'FIXTURE', ServiceArea: 'AREA_1', MaxDistanceKm: maxDistance, AvailabilityStatus: availability });
  const login = await request('/api/auth/login', { method: 'POST', body: { email: user.Email, password } });
  assert.equal(login.status, 200, 'Đăng nhập bằng API thật');
  tokens.set(user.UserId, login.body.token);
  return user;
}
let buyer, seller, category, counter = 0;
async function trip(overrides = {}) {
  const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: `${prefix}_${++counter}`, Description: 'Fixture database test riêng', Price: '100000.00', ConditionLevel: 'GOOD', Status: 'RESERVED' });
  const confirmedAt = new Date(Date.now() - 10000), readyAt = new Date(Date.now() - 5000);
  const order = await Orders.create({ BuyerId: buyer.UserId, SellerId: seller.UserId, ListingId: listing.ListingId, DeliveryMethod: 'DELIVERY', DeliveryFeeRuleId: 1,
    ReceiverName: 'Private fixture', ReceiverPhone: '0900000123', ReceiverAddress: 'Địa chỉ riêng chỉ sau phân công', ProductAmount: '100000.00', DeliveryFee: '20000.01', TotalAmount: '120000.01',
    Status: 'PAID', ReservedUntil: new Date(Date.now() + 60000), ...overrides.order });
  await Payments.create({ OrderId: order.OrderId, PayerId: buyer.UserId, PayeeId: seller.UserId, Amount: order.ProductAmount, BankName: 'Fixture bank',
    BankAccountSnapshot: '1234567890', BankAccountHolderSnapshot: 'FIXTURE', TransferContent: `Fixture ${order.OrderId}`, ProofUrl: '/private-proof.png',
    Status: 'CONFIRMED', ReportedAt: new Date(confirmedAt.getTime() - 5000), ConfirmedAt: confirmedAt, ConfirmedBy: seller.UserId, ...overrides.payment });
  const delivery = await Deliveries.create({ OrderId: order.OrderId, PickupAddress: 'Địa chỉ người bán riêng', DeliveryAddress: order.ReceiverAddress, DriverFee: order.DeliveryFee,
    Status: 'AVAILABLE', DriverId: null, PreparedBy: seller.UserId, ReadyForPickupAt: readyAt, PickupArea: 'AREA_1', DeliveryArea: 'AREA_1', VehicleType: 'MOTORBIKE', RouteDistanceKm: '5.00', ...overrides.delivery });
  return { order, delivery };
}
const accept = (user, delivery, body = {}) => request(`/api/v1/driver/deliveries/${delivery.DeliveryId}/accept`, { user, method: 'PATCH', body });
const countHistory = id => StatusHistories.count({ where: { DeliveryId: id, StatusType: 'DELIVERY', StatusValue: 'ACCEPTED' } });
async function main() {
  const connection = await scalar('SELECT DATABASE() AS db, @@server_uuid AS uuid');
  assert.equal(connection.db, `${process.env.DB_NAME}_test`); assert.match(connection.db, /^cho_do_cu_d07_.+_test$/);
  assert.equal(connection.uuid, process.env.D07_EXPECTED_MYSQL_UUID, 'Không được kiểm tra nhầm MySQL CD');
  assert.equal(await Users.count({ where: { Username: { [require('sequelize').Op.like]: `${prefix}%` } } }), 0);
  for (const RoleName of ['USER', 'SELLER', 'DRIVER']) await Roles.findOrCreate({ where: { RoleName } });
  server = app.listen(browserMode ? 3000 : 0, '0.0.0.0'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  buyer = await person('buyer', { application: null, driver: false, profile: false }); seller = await person('seller', { application: 'SELLER', driver: false, profile: false });
  category = await Categories.create({ CategoryName: prefix, Status: 'ACTIVE' });
  const d1 = await person('driver1'), d2 = await person('driver2');
  await checks('JWT thật: guest/dev/demo/token sai không vượt xác thực', async () => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: d1.UserId, exp: 1 })}`;
    const expired = payload + '.' + crypto.createHmac('sha256', require('../src/utils/jwtSecret').getJwtSecret()).update(payload).digest('base64url');
    for (const path of ['/api/v1/driver/status', '/api/v1/driver/deliveries/available', '/api/v1/driver/deliveries/1/accept']) {
      for (const headers of [{ 'x-user-id': String(d1.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }, { Authorization: `Bearer ${expired}` }]) {
        assert.equal((await request(path, { method: path.endsWith('accept') ? 'PATCH' : 'GET', headers })).status, 401);
      }
    }
  });
  await checks('C01 tạo PENDING cho chính JWT; giả UserId bị chặn; trạng thái DRIVER riêng SELLER', async () => {
    const created = await request('/api/partner-applications', { user: buyer, method: 'POST', body: { PartnerType: 'DRIVER' } });
    assert.equal(created.status, 201); assert.equal(created.body.data.UserId, buyer.UserId); assert.equal(created.body.data.Status, 'PENDING');
    assert.equal((await request('/api/partner-applications', { user: buyer, method: 'POST', body: { PartnerType: 'DRIVER', UserId: seller.UserId } })).status, 403);
    assert.equal((await request('/api/v1/driver/status', { user: buyer })).body.data.application.Status, 'PENDING');
    assert.equal((await request('/api/v1/driver/status', { user: seller })).body.data.application, null);
    assert.equal((await request('/api/v1/driver/deliveries/available', { user: seller })).status, 403);
  });
  await checks('C01 PENDING/REJECTED, B02 thiếu role, D11 thiếu/OFFLINE/BUSY, tài khoản khóa', async () => {
    for (const [name, options, code] of [
      ['none', { application: null }, 403], ['pending', { application: 'PENDING' }, 403], ['rejected', { application: 'REJECTED' }, 403],
      ['norole', { driver: false }, 403], ['noprofile', { profile: false }, 409], ['offline', { availability: 'OFFLINE' }, 409], ['busy', { availability: 'BUSY' }, 409],
    ]) { const user = await person(name, options); assert.equal((await request('/api/v1/driver/deliveries/available', { user })).status, code); }
    const locked = await person('locked'); await locked.update({ Status: 'LOCKED' }); assert.equal((await request('/api/v1/driver/status', { user: locked })).status, 403);
  });
  const sample = await trip();
  await checks('GET chỉ đọc, phân trang SQL, không lộ địa chỉ/số điện thoại/bank/proof/mã xác thực', async () => {
    const before = [await Deliveries.count(), await StatusHistories.count(), await Notifications.count(), (await DriverProfiles.findOne({ where: { UserId: d1.UserId } })).AvailabilityStatus];
    const response = await request('/api/v1/driver/deliveries/available?limit=1', { user: d1 });
    assert.equal(response.status, 200); assert.equal(response.body.data.length, 1); assert.equal(response.body.data[0].driverFee, '20000.01');
    assert.deepEqual(Object.keys(response.body.data[0]).sort(), ['deliveryId', 'orderId', 'pickupArea', 'deliveryArea', 'vehicleType', 'driverFee', 'readyAt'].sort());
    assert.deepEqual([await Deliveries.count(), await StatusHistories.count(), await Notifications.count(), (await DriverProfiles.findOne({ where: { UserId: d1.UserId } })).AvailabilityStatus], before);
    assert.equal((await request('/api/v1/driver/deliveries/available?pickupArea=AREA_2', { user: d1 })).body.data.length, 0);
    assert.equal((await request('/api/v1/driver/deliveries/available?sort=bad', { user: d1 })).status, 400);
    assert.equal((await request(`/api/v1/orders/${sample.order.OrderId}/tracking`, { user: d1 })).status, 403);
  });
  await checks('PATCH kiểm tra lại quyền sau GET, ID/body giả mạo không được sử dụng', async () => {
    for (const body of [{ DriverId: d2.UserId }, { DriverFee: '0' }, { Status: 'DELIVERED' }]) assert.equal((await accept(d1, sample.delivery, body)).status, 400);
    assert.equal((await request('/api/v1/driver/deliveries/not-id/accept', { user: d1, method: 'PATCH', body: {} })).status, 400);
    const role = await UserRoles.findOne({ where: { UserId: d1.UserId } }); await role.destroy();
    assert.equal((await accept(d1, sample.delivery)).status, 403);
    // Chỉ phục hồi fixture trong DB test riêng, không cấp quyền cho user của nhóm.
    await UserRoles.create({ UserId: d1.UserId, RoleId: role.RoleId });
    await DriverProfiles.update({ VehicleType: 'TRUCK' }, { where: { UserId: d1.UserId } });
    assert.equal((await accept(d1, sample.delivery)).status, 409, 'Hồ sơ đổi sau GET phải được đọc lại');
    await DriverProfiles.update({ VehicleType: 'MOTORBIKE' }, { where: { UserId: d1.UserId } });
  });
  await checks('Eligibility chung: PICKUP/chưa trả tiền/hủy/hoàn tiền/C07 thiếu/tuyến sai/bán kính/fee lệch đều bị chặn', async () => {
    for (const overrides of [
      { order: { DeliveryMethod: 'PICKUP' } }, { order: { Status: 'WAITING_PAYMENT' } }, { order: { Status: 'CANCELLED' } },
      { payment: { Status: 'REPORTED' } }, { payment: { PayerId: seller.UserId } }, { payment: { Amount: '1' } },
      { delivery: { ReadyForPickupAt: null } }, { delivery: { PreparedBy: buyer.UserId } },
      { delivery: { PickupArea: 'AREA_2' } }, { delivery: { VehicleType: 'TRUCK' } }, { delivery: { RouteDistanceKm: null } },
      { delivery: { RouteDistanceKm: '21.00' } }, { delivery: { DriverFee: '1.00' } },
      { delivery: { Status: 'PICKED_UP' } }, { delivery: { Status: 'FAILED' } }, { delivery: { Status: 'RETURNING' } },
    ]) {
      const bad = await trip(overrides); assert.equal((await accept(d1, bad.delivery)).status, 409);
      const list = await request('/api/v1/driver/deliveries/available', { user: d1 }); assert.ok(!list.body.data.some(row => row.deliveryId === bad.delivery.DeliveryId));
    }
    const refundTrip = await trip(); await RefundRequests.create({ OrderId: refundTrip.order.OrderId, RequestedBy: buyer.UserId, Reason: 'Fixture', Amount: '100000', Status: 'PENDING' });
    assert.equal((await accept(d1, refundTrip.delivery)).status, 409);
  });
  await checks('Hai tài xế tranh cùng chuyến: đúng 1 winner, ACCEPTED/BUSY, PAID và fee không đổi', async () => {
    const responses = await Promise.all([accept(d1, sample.delivery), accept(d2, sample.delivery)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const current = await sample.delivery.reload(); assert.equal(current.Status, 'ACCEPTED'); assert.ok(current.AcceptedAt);
    assert.equal(current.DriverFee, '20000.01'); assert.equal((await sample.order.reload()).Status, 'PAID');
    const profile = await DriverProfiles.findOne({ where: { UserId: current.DriverId } }); assert.equal(profile.AvailabilityStatus, 'BUSY');
    assert.equal(await countHistory(current.DeliveryId), 1);
    const h = await StatusHistories.findOne({ where: { DeliveryId: current.DeliveryId, StatusValue: 'ACCEPTED' } }); assert.equal(h.ChangedBy, current.DriverId);
  });
  await checks('Retry và D05: không đổi AcceptedAt/lặp lịch sử/thông báo, chỉ đúng driver được xem', async () => {
    const current = await sample.delivery.reload(), own = current.DriverId === d1.UserId ? d1 : d2, other = own === d1 ? d2 : d1;
    const before = await Notifications.count(), acceptedAt = current.AcceptedAt.getTime();
    for (const response of await Promise.all([accept(own, current), accept(own, current)])) { assert.equal(response.status, 200); assert.equal(response.body.data.alreadyApplied, true); }
    assert.equal((await current.reload()).AcceptedAt.getTime(), acceptedAt); assert.equal(await Notifications.count(), before); assert.equal(await countHistory(current.DeliveryId), 1);
    for (const user of [own, buyer, seller]) {
      const response = await request(`/api/v1/orders/${sample.order.OrderId}/tracking`, { user }); assert.equal(response.status, 200);
      assert.equal(response.body.data.deliveries[0].driver.userId, own.UserId); assert.ok(response.body.data.histories.some(h => h.group === 'DELIVERY' && h.status === 'ACCEPTED'));
      assert.ok(!/CodeHash|PickupCode|CompletionCode|ProofUrl|BankAccountSnapshot/.test(JSON.stringify(response.body.data)));
    }
    assert.equal((await request(`/api/v1/orders/${sample.order.OrderId}/tracking`, { user: other })).status, 403);
    assert.equal((await request(`/api/v1/orders/${sample.order.OrderId}/tracking`, { headers: { 'x-user-id': String(own.UserId) } })).status, 401, 'Không được giả danh assigned driver bằng header dev');
    const status = (await request('/api/v1/driver/status', { user: own })).body.data; assert.equal(status.activeDelivery.deliveryId, current.DeliveryId);
  });
  await checks('Một driver tranh hai chuyến: MySQL mutex không cho nhận cả hai', async () => {
    const driver = await person('double'), a = await trip(), b = await trip();
    const responses = await Promise.all([accept(driver, a.delivery), accept(driver, b.delivery)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]); assert.equal(await Deliveries.count({ where: { DriverId: driver.UserId } }), 1);
  });
  await checks('Lỗi ghi thông báo rollback assignment + BUSY + history trên MySQL thật', async () => {
    const driver = await person('rollback'), t = await trip(), before = await Notifications.count();
    const service = createAssignmentService({ repository: { ...repository, notifyUser: async () => { throw new Error('D07 injected fixture failure'); } } });
    await assert.rejects(service.accept(t.delivery.DeliveryId, {}, actor(driver)), /injected fixture failure/);
    assert.equal((await t.delivery.reload()).DriverId, null); assert.equal((await t.delivery.reload()).Status, 'AVAILABLE');
    assert.equal((await DriverProfiles.findOne({ where: { UserId: driver.UserId } })).AvailabilityStatus, 'AVAILABLE');
    assert.equal(await countHistory(t.delivery.DeliveryId), 0); assert.equal(await Notifications.count(), before);
  });
  await checks('Nhận song song B06: serialize ORDER, refund trước chặn nhận; nhận trước giữ BUSY và thông báo dừng', async () => {
    const driver = await person('refundrace'), t = await trip();
    const [accepted, refund] = await Promise.all([accept(driver, t.delivery), request(`/api/v1/orders/${t.order.OrderId}/refund-requests`, { user: buyer, method: 'POST',
      body: { reason: 'Không nhận được hàng', refundBankCode: '970418', refundAccountNumber: '1234567890', refundAccountHolder: 'FIXTURE' } })]);
    assert.equal(refund.status, 201, refund.body.message); assert.ok([200, 409].includes(accepted.status)); assert.equal((await t.order.reload()).Status, 'REFUND_PENDING');
    if (accepted.status === 200) {
      assert.equal((await t.delivery.reload()).DriverId, driver.UserId);
      assert.equal((await DriverProfiles.findOne({ where: { UserId: driver.UserId } })).AvailabilityStatus, 'BUSY');
      assert.equal((await request('/api/v1/driver/status', { user: driver })).body.data.activeDelivery.blocked, true);
      assert.ok(await Notifications.count({ where: { UserId: driver.UserId, Title: 'Đơn đang yêu cầu hoàn tiền', ReferenceId: t.order.OrderId } }));
    } else assert.equal((await t.delivery.reload()).DriverId, null);
    const second = await person('refundafter'); assert.equal((await accept(second, t.delivery)).status, 409);
  });
  await checks('Nhận song song D02 không hủy trực tiếp đơn PAID, không tạo CANCELLED+ACCEPTED', async () => {
    const driver = await person('cancelrace'), t = await trip();
    const [accepted, cancelled] = await Promise.all([accept(driver, t.delivery), request(`/api/v1/orders/${t.order.OrderId}/cancel`, { user: buyer, method: 'PATCH', body: { reason: 'Không còn nhu cầu' } })]);
    assert.equal(accepted.status, 200); assert.equal(cancelled.status, 409); assert.equal((await t.order.reload()).Status, 'PAID');
  });
  await checks('Điểm tạo chuyến C07 server: không tạo thiếu dữ liệu, snapshot fee giữ nguyên, OrderId chống trùng', async () => {
    const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: prefix + '_prepared', Description: 'Fixture', Price: '100000', ConditionLevel: 'GOOD', Status: 'RESERVED' });
    const order = await Orders.create({ BuyerId: buyer.UserId, SellerId: seller.UserId, ListingId: listing.ListingId, DeliveryMethod: 'DELIVERY', DeliveryFeeRuleId: 12,
      ReceiverName: 'Fixture', ReceiverPhone: '0900000111', ReceiverAddress: 'Private', ProductAmount: '100000', DeliveryFee: '12345.67', TotalAmount: '112345.67', Status: 'PAID', ReservedUntil: new Date() });
    const at = new Date(Date.now() - 10000);
    await Payments.create({ OrderId: order.OrderId, PayerId: buyer.UserId, PayeeId: seller.UserId, Amount: '100000', BankName: 'Fixture', BankAccountSnapshot: '1234567890', BankAccountHolderSnapshot: 'FIXTURE', TransferContent: 'Fixture', ProofUrl: '/proof.png', Status: 'CONFIRMED', ReportedAt: at, ConfirmedAt: at, ConfirmedBy: seller.UserId });
    await assert.rejects(sequelize.transaction(tx => createPreparedDelivery(order.OrderId, null, null, tx)), { status: 409 });
    const preparation = { sellerId: seller.UserId, readyAt: new Date(Date.now() - 5000), pickupAddress: 'Private pickup' };
    const route = { ruleId: 12, pickupArea: 'AREA_1', deliveryArea: 'AREA_1', vehicleType: 'MOTORBIKE', driverFee: '12345.67', routeDistanceKm: null };
    const a = await sequelize.transaction(tx => createPreparedDelivery(order.OrderId, preparation, route, tx));
    const b = await sequelize.transaction(tx => createPreparedDelivery(order.OrderId, preparation, route, tx));
    assert.equal(a.DeliveryId, b.DeliveryId); assert.equal(b.DriverFee, '12345.67'); assert.equal(b.RouteDistanceKm, null);
    assert.equal(await Deliveries.count({ where: { OrderId: order.OrderId } }), 1);
    await assert.rejects(sequelize.transaction(tx => createPreparedDelivery(order.OrderId, preparation, { ...route, driverFee: '999' }, tx)), { status: 409 });
  });
  console.log(`PASS: ${completed} nhóm kiểm thử trên ${connection.db}; không ghi database cho_do_cu, không SMTP, không tự duyệt/cấp quyền tài khoản thật.`);
  if (browserMode) {
    const browserDriver = await person('browserdriver');
    const browserArea = `AREA_${prefix}`;
    await DriverProfiles.update({ ServiceArea: browserArea }, { where: { UserId: browserDriver.UserId } });
    await person('browserplain', { application: null, driver: false, profile: false });
    await person('browseroffline', { availability: 'OFFLINE' }); await person('browserpending', { application: 'PENDING' });
    const fixture = await trip({ delivery: { PickupArea: browserArea, DeliveryArea: browserArea } });
    // Chỉ in mã fixture; mật khẩu/token không vào stdout/log/file.
    console.log('D07_BROWSER_FIXTURE ' + JSON.stringify({ deliveryId: fixture.delivery.DeliveryId, orderId: fixture.order.OrderId }));
    await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
  }
}
main().catch(error => { console.error('FAIL D07:', error.name, error.code || '', error.message); process.exitCode = 1; }).finally(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await sequelize.close();
});
