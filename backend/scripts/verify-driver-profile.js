'use strict';
if (process.env.D11_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Chỉ chạy D11 trên MySQL local/test riêng đã xác minh.');
process.env.AUTH_DEV_HEADER = 'true'; process.env.D01_DEMO_MODE = 'true'; // Kiểm chứng D11 vẫn từ chối hai cơ chế này.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createEnvironment } = require('../tests/helpers/d08-fixture');
const { pngReceipt } = require('../tests/D03_ThanhToan/fixtures');
let f, count = 0;
async function check(name, work) { await work(); console.log(`PASS D11 ${++count}: ${name}`); }
async function main() {
  f = await createEnvironment();
  const { DriverProfiles, Users, UserRoles, PartnerApplications, Deliveries, StatusHistories, Notifications, sequelize } = f.models;
  const profilePath = '/api/v1/driver/profile', availabilityPath = '/api/v1/driver/availability';
  const operational = { VehicleType: 'MOTORBIKE', VehiclePlate: ' 59 a 123 ', ServiceArea: 'AREA_1', MaxDistanceKm: null };
  const bank = { BankName: 'TEST BANK', BankAccountNumber: '000012345678', BankAccountHolder: 'TEST DRIVER' };
  const driver = await f.person(undefined, { driver: true, profile: false });
  const get = user => f.request(profilePath, { user });
  const patch = (body, user = driver) => f.request(profilePath, { user, method: 'PATCH', body });
  const status = (AvailabilityStatus, user = driver) => f.request(availabilityPath, { user, method: 'PATCH', body: { AvailabilityStatus } });
  const upload = (body, buffer = pngReceipt(), user = driver, type = 'image/png') => {
    const form = new FormData(); form.append('profile', JSON.stringify(body)); form.append('qr', new Blob([buffer], { type }), 'qr.png');
    return f.request(profilePath, { user, method: 'PATCH', form });
  };
  await check('C01 -> B02 thật cấp thêm DRIVER -> D11, không tự duyệt hoặc thay vai trò khác', async () => {
    const applicant = await f.person(), admin = await f.person();
    const [adminRole] = await f.models.Roles.findOrCreate({ where: { RoleName: 'ADMIN' } });
    const userRole = await f.models.Roles.findOne({ where: { RoleName: 'USER' } });
    // Chỉ tài khoản fixture trong DB test riêng, không cấp quyền tài khoản của nhóm.
    await UserRoles.create({ UserId: admin.UserId, RoleId: adminRole.RoleId });
    await UserRoles.create({ UserId: applicant.UserId, RoleId: userRole.RoleId });
    const application = await f.request('/api/partner-applications', { user: applicant, method: 'POST', body: { PartnerType: 'DRIVER' } });
    assert.equal(application.status, 201); assert.equal(application.body.data.Status, 'PENDING');
    assert.equal((await get(applicant)).status, 403);
    const path = `/api/v1/admin/partner-applications/${application.body.data.ApplicationId}`;
    assert.equal((await f.request(path, { user: applicant, method: 'PATCH', body: { status: 'APPROVED' } })).status, 403);
    const reviewed = await f.request(path, { user: admin, method: 'PATCH', body: { status: 'APPROVED', expectedStatus: 'PENDING' } });
    assert.equal(reviewed.status, 200);
    assert.equal((await get(applicant)).status, 200); assert.equal((await get(applicant)).body.data.profile, null);
    assert.equal(await UserRoles.count({ where: { UserId: applicant.UserId } }), 2);
    assert.equal((await patch(operational, applicant)).status, 200);
  });
  await check('JWT thật; tài khoản thường/SELLER/chưa duyệt/thu hồi role/khóa bị chặn', async () => {
    for (const headers of [{}, { 'x-user-id': String(driver.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }]) assert.equal((await f.request(profilePath, { headers })).status, 401);
    for (const u of [f.outsider, await f.person(undefined, { driver: true, application: 'PENDING' })]) assert.equal((await get(u)).status, 403);
    const seller = await f.person(); const [role] = await sequelize.query("SELECT RoleId FROM Roles WHERE RoleName='SELLER'");
    await UserRoles.create({ UserId: seller.UserId, RoleId: role[0].RoleId }); await PartnerApplications.create({ UserId: seller.UserId, PartnerType: 'SELLER', Status: 'APPROVED' });
    assert.equal((await get(seller)).status, 403);
    await PartnerApplications.update({ PartnerType: 'SELLER' }, { where: { UserId: driver.UserId } }); assert.equal((await get(driver)).status, 403);
    await PartnerApplications.update({ PartnerType: 'DRIVER' }, { where: { UserId: driver.UserId } });
    const grant = await UserRoles.findOne({ where: { UserId: driver.UserId } }); await grant.destroy(); assert.equal((await get(driver)).status, 403);
    await UserRoles.create({ UserId: driver.UserId, RoleId: grant.RoleId });
    await Users.update({ Status: 'LOCKED' }, { where: { UserId: driver.UserId } }); assert.equal((await get(driver)).status, 403);
    await Users.update({ Status: 'ACTIVE' }, { where: { UserId: driver.UserId } });
  });
  await check('GET hồ sơ thiếu chỉ đọc; không tạo profile/history/notification', async () => {
    const before = [await DriverProfiles.count(), await StatusHistories.count(), await Notifications.count()];
    const response = await get(driver); assert.equal(response.status, 200); assert.equal(response.body.data.profile, null);
    assert.deepEqual([await DriverProfiles.count(), await StatusHistories.count(), await Notifications.count()], before);
    assert.equal((await status('AVAILABLE')).status, 409);
  });
  await check('Không mass assign, không URL QR lạ, validation operation/bank/radius', async () => {
    for (const key of ['UserId', 'DriverProfileId', 'role', 'AvailabilityStatus', 'UpdatedAt', 'QrImageUrl']) assert.equal((await patch({ ...operational, [key]: 'fake' })).status, 400);
    for (const key of ['VehicleType', 'VehiclePlate', 'ServiceArea']) assert.equal((await patch({ ...operational, [key]: '' })).status, 400);
    for (const value of [0, -1, '10000', 'NaN', '0.001', true]) assert.equal((await patch({ ...operational, MaxDistanceKm: value })).status, 400);
    assert.equal((await patch({ ...operational, BankAccountNumber: 123 })).status, 400);
    assert.equal((await patch({ ...operational, BankName: 'TEST' })).status, 400);
  });
  await check('Hai tạo lần đầu đồng thời: một UserId, OFFLINE, NULL radius, giữ số 0 đầu', async () => {
    const responses = await Promise.all([patch({ ...operational, ...bank }), patch({ ...operational, ...bank })]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    assert.equal(await DriverProfiles.count({ where: { UserId: driver.UserId } }), 1);
    const p = (await get(driver)).body.data.profile; assert.equal(p.AvailabilityStatus, 'OFFLINE'); assert.equal(p.MaxDistanceKm, null); assert.equal(p.BankAccountNumber, bank.BankAccountNumber); assert.equal(p.VehiclePlate, '59 A 123');
    assert.equal((await patch({ MaxDistanceKm: '9999.99' })).status, 200);
    assert.equal((await patch({ MaxDistanceKm: null })).status, 200);
    assert.equal((await patch({ VehiclePlate: '59B' })).body.data.profile.BankAccountNumber, bank.BankAccountNumber, 'PATCH không xóa trường bỏ qua');
  });
  await check('Bank-only AVAILABLE; xóa phương thức cuối bị rollback; OFFLINE cho phép xóa', async () => {
    assert.equal((await status('AVAILABLE')).status, 200);
    assert.equal((await patch({ BankName: null, BankAccountNumber: null, BankAccountHolder: null })).status, 409);
    assert.equal((await get(driver)).body.data.profile.BankAccountNumber, bank.BankAccountNumber);
    assert.equal((await status('OFFLINE')).status, 200);
    assert.equal((await patch({ BankName: null, BankAccountNumber: null, BankAccountHolder: null })).status, 200);
    assert.equal((await status('AVAILABLE')).status, 409);
    assert.equal((await status('BUSY')).status, 400);
  });
  let qrUrl;
  await check('QR-only hợp lệ, riêng tư theo chủ + mục đích, không phải URL công khai', async () => {
    const r = await upload({}); assert.equal(r.status, 200); qrUrl = r.body.data.profile.QrImageUrl;
    assert.equal((await status('AVAILABLE')).status, 200);
    assert.equal((await f.request(qrUrl, { user: driver, raw: true })).status, 200);
    const other = await f.person(undefined, { driver: true });
    assert.equal((await f.request(qrUrl, { user: other })).status, 404);
    assert.equal((await patch({ QrImageUrl: qrUrl }, other)).status, 400);
    assert.equal((await f.request(qrUrl)).status, 401);
    assert.equal((await f.request('/api/v1/uploads/.d11/anything')).status, 404);
  });
  await check('Ảnh giả/sai MIME/quá 5MB/thừa field/lưu lỗi giữ nguyên QR và readiness', async () => {
    for (const [body, buffer, type, expected] of [[{}, Buffer.from('not image'), 'image/png', 400], [{}, pngReceipt(), 'text/plain', 400], [{}, Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 413], [{ UserId: 1 }, pngReceipt(), 'image/png', 400], [{ RemoveQr: true }, pngReceipt(), 'image/png', 400]]) {
      assert.equal((await upload(body, buffer, driver, type)).status, expected);
      assert.equal((await get(driver)).body.data.profile.QrImageUrl, qrUrl);
    }
    assert.equal((await patch({ RemoveQr: true })).status, 409);
    assert.equal((await get(driver)).body.data.qrValid, true);
    const r = await upload({}); assert.equal(r.status, 200); assert.notEqual(r.body.data.profile.QrImageUrl, qrUrl);
    assert.equal((await f.request(qrUrl, { user: driver })).status, 404, 'QR thay thế không còn đọc được qua endpoint'); qrUrl = r.body.data.profile.QrImageUrl;
  });
  await check('Rollback sau ghi file không thay QR cũ; không xóa nhầm ảnh đang tham chiếu', async () => {
    const repo = require('../src/repositories/D11_HoSoVanHanhTaiXe/profile.repository');
    const original = repo.update;
    try { repo.update = async () => { throw new Error('fixture rollback'); }; assert.equal((await upload({})).status, 500); }
    finally { repo.update = original; }
    assert.equal((await get(driver)).body.data.profile.QrImageUrl, qrUrl);
    assert.equal((await f.request(qrUrl, { user: driver, raw: true })).status, 200);
  });
  await check('D07 kiểm tra nhận phí tại request, DTO không lộ ngân hàng; QR-only nhận được chuyến', async () => {
    const t = await f.trip({ driver, accept: false });
    const s = await f.request('/api/v1/driver/status', { user: driver });
    assert.equal(s.status, 200); assert.equal(JSON.stringify(s.body).includes(bank.BankAccountNumber), false); assert.equal(Object.hasOwn(s.body.data.profile, 'BankName'), false);
    assert.equal((await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/accept`, { user: driver, method: 'PATCH', body: {} })).status, 200);
    assert.equal((await get(driver)).body.data.profile.AvailabilityStatus, 'BUSY');
    for (const mode of ['OFFLINE', 'AVAILABLE']) assert.equal((await status(mode)).status, 409);
    assert.equal((await patch({ VehiclePlate: 'CHANGED' })).status, 409);
    const before = await f.read(t); await Users.update({ Status: 'LOCKED' }, { where: { UserId: driver.UserId } }); assert.equal((await patch({})).status, 403);
    assert.equal((await f.read(t)).DriverId, before.DriverId); await Users.update({ Status: 'ACTIVE' }, { where: { UserId: driver.UserId } });
    // Tiếp tục thật D08 -> D09 -> D10; không dựng trạng thái giao thành công D13.
    const code = await f.issue(t); assert.equal(code.status, 200); assert.equal((await f.pickup(t, code.body.data.pickupCode)).status, 200);
    assert.equal((await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/status`, { user: driver, method: 'PATCH', headers: { 'Idempotency-Key': randomUUID() }, body: { status: 'DELIVERING', action: 'START' } })).status, 200);
    const action = async (action, body = {}) => {
      const p = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/failure-preview`, { user: driver }); assert.equal(p.status, 200);
      return f.request(`/api/v1/driver/deliveries/${t.deliveryId}/${action === 'FAIL' ? 'failure' : 'return'}`, { user: driver, method: 'PATCH', headers: { 'Idempotency-Key': randomUUID(), 'If-Match': p.body.data.version }, body: { action, ...body } });
    };
    assert.equal((await action('FAIL', { reasonCode: 'UNAVAILABLE' })).status, 200);
    assert.equal((await status('OFFLINE')).status, 409, 'FAILED vẫn giữ kiện');
    assert.equal((await action('START_RETURN')).status, 200);
    assert.equal((await status('AVAILABLE')).status, 409, 'RETURNING chưa giải phóng');
    assert.equal((await patch({ RemoveQr: true })).status, 409);
    assert.equal((await action('CONFIRM_RETURN', { recipientName: 'Fixture seller', handoverConfirmed: true })).status, 200);
    const released = (await get(driver)).body.data; assert.equal(released.activeDelivery, null); assert.equal(released.profile.AvailabilityStatus, 'OFFLINE');
    assert.equal((await status('AVAILABLE')).status, 200, 'D10 RETURNED cho bật lại, không chờ D06');
  });
  await check('D07 phải chặn profile AVAILABLE bị mất phương thức nhận phí trong DB', async () => {
    const u = await f.person(undefined, { driver: true });
    await DriverProfiles.update({ BankName: null, BankAccountNumber: null, BankAccountHolder: null }, { where: { UserId: u.UserId } });
    const t = await f.trip({ driver: u, accept: false });
    const r = await f.request(`/api/v1/driver/deliveries/${t.deliveryId}/accept`, { user: u, method: 'PATCH', body: {} }); assert.equal(r.status, 409); assert.equal(r.body.code, 'DRIVER_RECEIVING_REQUIRED');
    assert.equal((await f.read(t)).DriverId, null);
  });
  await check('Đồng thời D07 nhận chuyến với OFFLINE/PATCH: không ghi đè BUSY, không bỏ chuyến', async () => {
    for (let i = 0; i < 6; i++) {
      const u = await f.person(undefined, { driver: true }), t = await f.trip({ driver: u, accept: false });
      const [accept, change] = await Promise.all([
        f.request(`/api/v1/driver/deliveries/${t.deliveryId}/accept`, { user: u, method: 'PATCH', body: {} }),
        i % 2 ? patch({ VehiclePlate: 'TEST UPDATE' }, u) : status('OFFLINE', u),
      ]);
      const p = await DriverProfiles.findOne({ where: { UserId: u.UserId } }), d = await f.read(t);
      assert.ok([200, 409].includes(accept.status)); assert.ok([200, 409].includes(change.status));
      if (accept.status === 200) { assert.equal(p.AvailabilityStatus, 'BUSY'); assert.equal(d.DriverId, u.UserId); if (!(i % 2)) assert.equal(change.status, 409); }
      else { assert.equal(change.status, 200); assert.equal(p.AvailabilityStatus, 'OFFLINE'); assert.equal(d.DriverId, null); }
    }
  });
  await check('Predicate active bao gồm trạng thái lạ; chỉ DELIVERED/RETURNED là terminal (transaction rollback)', async () => {
    const u = await f.person(undefined, { driver: true }), t = await f.trip({ driver: u });
    const repo = require('../src/repositories/D11_HoSoVanHanhTaiXe/profile.repository');
    const tx = await sequelize.transaction();
    try {
      for (const value of ['ACCEPTED', 'PICKED_UP', 'DELIVERING', 'FAILED', 'RETURNING', 'UNKNOWN', 'DELIVERED', 'RETURNED']) {
        await Deliveries.update({ Status: value }, { where: { DeliveryId: t.deliveryId }, transaction: tx });
        assert.equal(!!(await repo.state(u.UserId, tx)).active, !['DELIVERED', 'RETURNED'].includes(value));
      }
    } finally { await tx.rollback(); }
    assert.equal((await f.read(t)).Status, 'ACCEPTED', 'Không dùng dựng DELIVERED để khẳng định D13 đã chạy');
  });
  console.log(`D11 integration: ${count} nhóm PASS; chỉ database test riêng. D13 chưa có endpoint nên chưa kiểm thử hoàn tất OTP.`);
}
main().catch(error => { console.error('D11 verification failed:', error.code || error.name, error.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
