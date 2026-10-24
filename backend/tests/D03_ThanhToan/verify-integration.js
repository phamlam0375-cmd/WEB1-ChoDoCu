'use strict';

// Chỉ chạy trên MySQL fixture riêng do người kiểm thử khởi động, không đọc .env
// của nhóm. Database phải trống; không reset, seed, start job hoặc cập nhật CD.
if (process.env.D03_ISOLATED_TEST !== 'true') throw new Error('Cần D03_ISOLATED_TEST=true và MySQL fixture riêng 127.0.0.1:33306.');
Object.assign(process.env, {
  NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: '33306', DB_NAME: 'cho_do_cu_d03_fixture', DB_USER: 'root',
  DB_PASSWORD: 'd03-isolated-fixture-only', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true',
});
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const { Sequelize, QueryTypes } = require('sequelize');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.D01_PLAYWRIGHT_PATH || 'playwright');
const models = require('../../src/models');
const { sequelize, Users, Roles, UserRoles, Store, Categories, Listings, Orders, Payments, RefundRequests, StatusHistories, Notifications } = models;
const d01 = require('../../src/services/order.service');
const d02 = require('../../src/services/D02_HuyDonHang/cancellation.service');
const d03 = require('../../src/services/D03_ThanhToan/payment.service');
const d01Repo = require('../../src/repositories/order.repository');
const d03Repo = require('../../src/repositories/D03_ThanhToan/payment.repository');
const { UPLOAD_DIR } = require('../../src/controllers/uploads.controller');
const { pngReceipt, jpgReceipt } = require('./fixtures');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

function token(id) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub: String(id), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  return `${h}.${p}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}

async function main() {
  let browser;
  const servers = [], proofNames = new Set();
  const remember = info => { if (info?.proofUrl) proofNames.add(path.basename(info.proofUrl)); return info; };
  const proof = () => ({ buffer: pngReceipt() });
  try {
    assert.equal(sequelize.config.database, 'cho_do_cu_d03_fixture'); assert.equal(Number(sequelize.config.port), 33306);
    const tables = await sequelize.getQueryInterface().showAllTables();
    assert.equal(tables.length, 0, 'Fixture DB phải trống. Không tự xóa bảng hoặc dùng DB nhóm.');
    for (const name of ['20260916000100-create-cho-do-cu-schema', '20260930000100-create-admin-audit-and-settings', '20261002000100-add-d01-order-fields', '20261002000100-member-b-report-v2', '20261012000100-d03-payment-holder-snapshot']) {
      await require(`../../migrations/${name}`).up(sequelize.getQueryInterface(), Sequelize);
    }
    console.log('PASS schema/migration mới trên DB fixture trống; không migrate/seed DB nhóm.');
    const roleMap = {};
    for (const RoleName of ['USER', 'SELLER', 'ADMIN']) roleMap[RoleName] = await Roles.create({ RoleName });
    async function user(name, role) {
      const row = await Users.create({ Username: `D03_${name}`, FullName: `D03 ${name}`, Email: `${name}@fixture.invalid`, Status: 'ACTIVE' });
      await UserRoles.create({ UserId: row.UserId, RoleId: roleMap[role].RoleId }); return row;
    }
    const buyer = await user('buyer', 'USER'), seller = await user('seller', 'SELLER'), admin = await user('admin', 'ADMIN');
    process.env.D01_DEMO_USER_ID = String(buyer.UserId);
    const store = await Store.create({ OwnerId: seller.UserId, StoreName: 'D03 fixture store', BankName: 'Fixture Bank', BankAccountNumber: '0001234567', BankAccountHolder: 'D03 FIXTURE SELLER', Status: 'ACTIVE' });
    const category = await Categories.create({ CategoryName: 'D03 isolated fixtures', Status: 'ACTIVE' });
    async function fixture(status = 'WAITING_PAYMENT') {
      const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: 'D03 fixture product', Description: 'Isolated test only', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
      const response = await d01.createOrder({ listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Fixture', receiverPhone: '0901234567' }, buyer.UserId);
      const order = await Orders.findByPk(response.data.orderId);
      // Fixture giả lập đầu ra C06, chỉ trong DB test. D03 không làm C06.
      if (status !== 'RESERVED') await order.update({ Status: status });
      return { order, listing };
    }
    const report = async f => remember((await d03.reportPayment(f.order.OrderId, { amount: f.order.ProductAmount }, proof(), buyer)).data);
    async function reportedOnce(f) {
      assert.equal((await Orders.findByPk(f.order.OrderId)).Status, 'WAITING_PAYMENT');
      assert.equal((await Listings.findByPk(f.listing.ListingId)).Status, 'RESERVED');
      assert.equal(await Payments.count({ where: { OrderId: f.order.OrderId } }), 1);
      assert.equal(await StatusHistories.count({ where: { OrderId: f.order.OrderId, StatusType: 'PAYMENT', StatusValue: 'REPORTED' } }), 1);
      assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: f.order.OrderId, Type: 'PAYMENT' } }), 1);
    }

    const repeat = await fixture();
    const info = await d03.getPaymentInfo(repeat.order.OrderId, buyer);
    await store.update({ BankAccountNumber: '999999999', BankAccountHolder: 'NEW HOLDER' });
    assert.deepEqual((await d03.getPaymentInfo(repeat.order.OrderId, buyer)).bank, info.bank);
    await store.update({ BankAccountNumber: '0001234567', BankAccountHolder: 'D03 FIXTURE SELLER' });
    const repeated = await Promise.all([report(repeat), report(repeat)]);
    assert.equal(new Set(repeated.map(r => r.proofUrl)).size, 1); await reportedOnce(repeat);
    await assert.rejects(d02.cancelOrder(repeat.order.OrderId, { reason: 'Test race' }, buyer), { code: 'PAYMENT_VERIFICATION_REQUIRED' });
    console.log('PASS SQL: snapshot bank ổn định; hai report đồng thời -> 1 payment/history/notification/proof; D02 không mở món REPORTED.');

    const race = await fixture();
    const outcomes = await Promise.allSettled([report(race), d02.cancelOrder(race.order.OrderId, { reason: 'Race' }, buyer)]);
    const latest = await Orders.findByPk(race.order.OrderId), pay = await Payments.findOne({ where: { OrderId: race.order.OrderId } });
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    if (latest.Status === 'CANCELLED') {
      assert.ok(!pay || pay.Status === 'WAITING'); assert.equal((await Listings.findByPk(race.listing.ListingId)).Status, 'ACTIVE');
    } else { assert.equal(pay.Status, 'REPORTED'); await reportedOnce(race); }
    console.log(`PASS SQL race report vs cancel: winner=${latest.Status}/${pay?.Status || 'no payment'}, không vừa hủy vừa báo tiền.`);

    function expiry(f) {
      return d01.createOrderService({ clock: () => new Date(new Date(f.order.ReservedUntil).getTime() + 1000), repository: { ...d01Repo, findExpiredReservations: (now, _limit, transaction) => sequelize.query(
        'SELECT OrderId, BuyerId, SellerId, ListingId FROM Orders WHERE OrderId=:id AND Status=\'RESERVED\' AND ReservedUntil<=:now FOR UPDATE SKIP LOCKED',
        { replacements: { id: f.order.OrderId, now }, transaction, type: QueryTypes.SELECT }) } });
    }
    const reserved = await fixture('RESERVED');
    const expired = await Promise.allSettled([report(reserved), expiry(reserved).expireReservations()]);
    assert.equal(expired[0].status, 'rejected');
    // Job SKIP LOCKED có thể bỏ qua đơn đang được D03 kiểm tra; chu kỳ sau
    // phải xử lý được. Không đổi thiết kế job chỉ để ép assertion một chu kỳ.
    await expiry(reserved).expireReservations();
    assert.equal((await Orders.findByPk(reserved.order.OrderId)).Status, 'CANCELLED');
    assert.equal(await Payments.count({ where: { OrderId: reserved.order.OrderId } }), 0);
    const inconsistent = await fixture(); await report(inconsistent);
    // Kiểm tra phòng vệ của job khi dữ liệu cũ sai ORDER, chỉ đổi fixture.
    await inconsistent.order.update({ Status: 'RESERVED' });
    assert.equal((await expiry(inconsistent).expireReservations()).expiredCount, 0);
    assert.equal((await Listings.findByPk(inconsistent.listing.ListingId)).Status, 'RESERVED');
    await inconsistent.order.update({ Status: 'WAITING_PAYMENT' });
    console.log('PASS SQL expiry race: RESERVED chưa C06 không báo; payment REPORTED không bị job giải phóng món.');

    // Xác định thứ tự khóa với controller D03 thật, cả hai thứ tự đều được thử.
    for (const first of ['report', 'cancel']) {
      const f = await fixture(); let locked, release;
      const gotLock = new Promise(resolve => { locked = resolve; }), gate = new Promise(resolve => { release = resolve; });
      const chosen = first === 'report' ? d03.createPaymentService({ repository: { ...d03Repo, readState: async (id, tx) => { const result = await d03Repo.readState(id, tx); locked(); await gate; return result; } } })
        : d02.createCancellationService({ repository: { ...require('../../src/repositories/D02_HuyDonHang/cancellation.repository'), readState: async (id, tx) => { const result = await require('../../src/repositories/D02_HuyDonHang/cancellation.repository').readState(id, tx); locked(); await gate; return result; } } });
      const leader = first === 'report' ? chosen.reportPayment(f.order.OrderId, {}, proof(), buyer) : chosen.cancelOrder(f.order.OrderId, { reason: 'First' }, buyer);
      await gotLock;
      const follower = (first === 'report' ? d02.cancelOrder(f.order.OrderId, { reason: 'After' }, buyer) : report(f)).then(() => null, error => error);
      release(); const response = await leader; remember(response.data);
      assert.equal((await follower).code, first === 'report' ? 'PAYMENT_VERIFICATION_REQUIRED' : 'ORDER_NOT_PAYABLE');
      if (first === 'report') await reportedOnce(f);
    }
    console.log('PASS SQL locking: report-first chặn cancel; cancel-first chặn report; rollback/file không trùng.');

    const app = require('../../src/app');
    for (const [port, out] of [[4192, 'demo-on'], [4193, 'demo-off']]) {
      const dist = path.resolve(__dirname, `../../../frontend/dist/${out}`);
      await fs.access(path.join(dist, 'index.html'));
      const site = express(); site.use((req, res, next) => req.path.startsWith('/api/') ? app(req, res, next) : next());
      site.use(express.static(dist)); site.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
      const server = site.listen(port, '127.0.0.1'); servers.push(server);
      await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    }
    browser = await chromium.launch({ headless: true, executablePath: process.env.D01_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:4192', headers = { 'x-d01-demo': 'true' };
    const waiting = await fixture(), missing = await fixture();
    await page.goto(`${origin}/orders/${waiting.order.OrderId}/payment`);
    await page.getByText('Mã QR của người bán sẽ được cập nhật sau.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Khu vực QR người bán').locator('img').count(), 0);
    await page.getByRole('button', { name: 'Sao chép nội dung chuyển khoản', exact: true }).click();
    await page.getByText('Đã sao chép nội dung chuyển khoản.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click();
    await page.getByText('Vui lòng tải ảnh biên lai chuyển khoản.', { exact: true }).waitFor();
    await page.getByLabel('Biên lai chuyển khoản *', { exact: true }).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() });
    await page.getByAltText('Xem trước biên lai').waitFor();
    await page.getByRole('button', { name: 'Bỏ ảnh biên lai' }).click(); assert.equal(await page.getByAltText('Xem trước biên lai').count(), 0);
    await page.getByLabel('Biên lai chuyển khoản *', { exact: true }).setInputFiles({ name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: jpgReceipt() });
    let notices = 0; page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/payment-notice')) notices++; });
    await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).dblclick();
    await page.getByText('Đã gửi thông báo chuyển khoản cho người bán.', { exact: true }).waitFor();
    assert.equal(notices, 1); await reportedOnce(waiting);
    remember(await d03.getPaymentInfo(waiting.order.OrderId, buyer));
    await page.reload(); await page.getByText('Đã báo chuyển tiền — chờ người bán xác nhận', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).isDisabled(), true);
    await page.goto(`${origin}/orders/${waiting.order.OrderId}/cancel`); await page.getByText(/Đã báo chuyển tiền; cần người bán xác minh/).waitFor();
    console.log('PASS production browser: QR trống/manual bank/copy; chọn/đổi/bỏ biên lai JPG/PNG; double-click=1 POST; reload REPORTED; D02 bị chặn.');

    await store.update({ BankAccountHolder: null });
    await page.goto(`${origin}/orders/${missing.order.OrderId}/payment`);
    await page.getByText('Người bán chưa cập nhật thông tin nhận tiền.', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).isDisabled(), true);
    await store.update({ BankAccountHolder: 'D03 FIXTURE SELLER' });
    const newListing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: 'D03 entry fixture', Description: 'Fixture', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
    await page.goto(`${origin}/orders/create/${newListing.ListingId}`); await page.getByLabel('Họ và tên người nhận').fill('D03 Test'); await page.getByLabel('Số điện thoại').fill('0901234567');
    await page.getByRole('button', { name: /Đặt hàng và giữ món/ }).click(); await page.getByRole('button', { name: 'Thanh toán', exact: true }).click();
    await page.getByText('Chờ người bán chấp nhận đơn hàng ở C06.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).isDisabled(), true);
    console.log('PASS production D01 -> nút Thanh toán đúng OrderId -> RESERVED chờ C06; thiếu bank không làm hỏng trang.');

    async function post(id, options = {}) {
      const response = await context.request.post(`${origin}/api/v1/orders/${id}/payment-notice`, { headers, multipart: { proof: { name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() }, ...options } });
      return { response, body: await response.json() };
    }
    const apiFixture = await fixture();
    const badAmount = await post(apiFixture.order.OrderId, { amount: '146456.10' }); assert.equal(badAmount.response.status(), 400); assert.equal(badAmount.body.code, 'PAYMENT_AMOUNT_MISMATCH');
    const forged = await context.request.post(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/payment-notice`, { headers, multipart: { proof: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') } } }); assert.equal(forged.status(), 400);
    const missingProof = await context.request.post(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/payment-notice`, { headers, data: {} }); assert.equal(missingProof.status(), 400);
    const tooLarge = await context.request.post(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/payment-notice`, { headers, multipart: { proof: { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } } }); assert.equal(tooLarge.status(), 413);
    const [one, two] = await Promise.all([post(apiFixture.order.OrderId), post(apiFixture.order.OrderId)]);
    assert.equal(one.response.status(), 200); assert.equal(two.response.status(), 200); assert.equal([one, two].filter(r => r.body.data.alreadyReported).length, 1); remember(one.body.data); await reportedOnce(apiFixture);
    assert.equal((await context.request.get(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/payment-info`, { headers: { authorization: `Bearer ${token(seller.UserId)}` } })).status(), 403);
    assert.equal((await context.request.get(`${origin}/api/v1/admin/users`, { headers })).status(), 401);
    assert.equal((await context.request.get(`${origin}/api/v1/me`, { headers })).status(), 401);
    assert.equal((await context.request.post(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/refund-requests`, { headers, data: {} })).status(), 401);
    assert.equal((await context.request.get(`${origin}/api/v1/orders/${apiFixture.order.OrderId}/payment-info`, { headers: { authorization: 'Bearer invalid', ...headers } })).status(), 401);
    const off = await browser.newPage(); await off.goto(`http://127.0.0.1:4193/orders/${waiting.order.OrderId}/payment`); await off.waitForURL('**/login?returnTo=**');
    assert.equal(new URL(off.url()).searchParams.get('returnTo'), `/orders/${waiting.order.OrderId}/payment`);
    process.env.D01_DEMO_MODE = 'false'; assert.equal((await context.request.get(`${origin}/api/v1/orders/${waiting.order.OrderId}/payment-info`, { headers })).status(), 401); process.env.D01_DEMO_MODE = 'true';
    const signed = await browser.newContext(); await signed.addInitScript(accessToken => localStorage.setItem('accessToken', accessToken), token(buyer.UserId));
    const signedPage = await signed.newPage(); await signedPage.goto(`http://127.0.0.1:4193/orders/${waiting.order.OrderId}/payment`); await signedPage.getByText('Đã báo chuyển tiền — chờ người bán xác nhận', { exact: true }).first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS HTTP production: amount 400/fake image 400/missing 400/size 413/concurrent 200; owner-only; JWT-invalid no fallback; demo-off login; real JWT works; no admin/B bypass.');

    // Thử báo lại theo mô tả D03: D04 trả REJECTED trên fixture, giữ snapshot.
    const rejectedPayment = await Payments.findOne({ where: { OrderId: apiFixture.order.OrderId } });
    await rejectedPayment.update({ Status: 'REJECTED' });
    const retried = await post(apiFixture.order.OrderId); remember(retried.body.data);
    assert.equal(retried.response.status(), 200); assert.equal(retried.body.data.paymentId, rejectedPayment.PaymentId);
    await rejectedPayment.reload(); await rejectedPayment.update({ Status: 'CONFIRMED', ConfirmedBy: seller.UserId, ConfirmedAt: new Date() });
    const confirmed = await post(apiFixture.order.OrderId); assert.equal(confirmed.response.status(), 409);
    const refunded = await fixture('REFUND_PENDING'); assert.equal((await post(refunded.order.OrderId)).response.status(), 409);
    console.log('PASS retry REJECTED cùng PaymentId; CONFIRMED/refund không bị ghi đè.');

    await browser.close(); browser = null;
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    // Các kiểm thử hồi quy có sẵn chạy trên DB fixture này, không DB nhóm.
    for (const script of ['scripts/verify-order-concurrency.js', 'tests/D02_HuyDonHang/verify-concurrency.js', 'tests/D02_HuyDonHang/verify-production.js']) {
      const child = spawnSync(process.execPath, [script], { cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'development' }, encoding: 'utf8', timeout: 120000 });
      console.log(child.stdout); if (child.status !== 0) { console.error(child.stderr); throw new Error(`Regression failed: ${script}`); }
    }
    console.log('PASS D01/D02/B06-B07 regressions trên database fixture riêng.');
  } finally {
    if (browser) await browser.close();
    for (const server of servers) if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    // Tìm cả proof fixture nếu assertion fail giữa POST và remember(). Chỉ xóa
    // file d03-UUID mà DB riêng chứa, tuyệt đối không glob toàn thư mục uploads.
    try {
      for (const row of await Payments.findAll({ attributes: ['ProofUrl'], raw: true })) if (row.ProofUrl) proofNames.add(path.basename(row.ProofUrl));
      for (const row of await StatusHistories.findAll({ where: { StatusType: 'PAYMENT' }, attributes: ['Note'], raw: true })) {
        const match = row.Note?.match(/^Biên lai: \/api\/v1\/uploads\/(d03-[0-9a-f-]+\.(?:png|jpg))$/); if (match) proofNames.add(match[1]);
      }
      for (const name of proofNames) {
        assert.match(name, /^d03-[0-9a-f]{8}-[0-9a-f-]{27}\.(?:png|jpg)$/);
        await fs.unlink(path.join(UPLOAD_DIR, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      console.log(`CLEANUP: ${proofNames.size} file biên lai fixture riêng đã dọn; dữ liệu SQL chỉ trong MySQL test tmpfs.`);
    } finally { await sequelize.close(); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
