'use strict';

// Opt-in integration/browser verification. Uses the existing team schema and
// creates only clearly named local fixtures. Never resets/seeds/imports a DB.
if (process.env.D04_LOCAL_TEST !== 'true') throw new Error('D04_LOCAL_TEST=true is required.');
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu', NODE_ENV: 'development' });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { sequelize, Users, Roles, UserRoles, Store, Categories, Listings, Orders, Payments, StatusHistories, Notifications, Commissions, RefundRequests } = require('../../src/models');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
const d04 = require('../../src/services/D04_XacNhanNhanTien/confirmation.service');
const d04Repository = require('../../src/repositories/D04_XacNhanNhanTien/confirmation.repository');
const job = require('../../src/jobs/reservationExpiration.job');

const base = 'http://localhost:5173/api/v1';
const runId = Date.now().toString(36);
let seller, category, fixtureCount = 0;
const buyerId = 1;
const buyerHeaders = { 'x-d01-demo': 'true' };
const sellerHeaders = () => ({ 'x-user-id': String(seller.UserId) });
const sellerBody = (info, action = 'CONFIRM', note = '') => ({ action, reportVersion: info.reportVersion, note });

async function request(url, headers, method = 'GET', body) {
  const response = await fetch(base + url, { method, headers: body && !(body instanceof FormData) ? { ...headers, 'content-type': 'application/json' } : headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function info(id) {
  const result = await request(`/seller/orders/${id}/payment`, sellerHeaders());
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data;
}
async function report(id) {
  const form = new FormData(); form.append('proof', new Blob([pngReceipt()], { type: 'image/png' }), 'local-d04-receipt.png');
  const result = await request(`/orders/${id}/payment-notice`, buyerHeaders, 'POST', form);
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data;
}
async function createFixture(label, { accept = true, reported = true } = {}) {
  const listing = await Listings.create({ SellerId: seller.UserId, StoreId: seller.StoreId, CategoryId: category.CategoryId,
    Title: `D04 local ${runId} ${label}`, Description: 'Local integration fixture only; no real bank transfer.', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
  const created = await request('/orders', buyerHeaders, 'POST', { listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'D04 local buyer', receiverPhone: '0900000001', note: `D04-LOCAL-${runId}-${label}` });
  assert.equal(created.status, 201, JSON.stringify(created.body)); const id = created.body.data.orderId;
  fixtureCount++;
  if (accept) {
    // C06 is not implemented yet. Simulate its documented transition only for
    // this newly created fixture, not with a fake endpoint or a D04 bypass.
    await sequelize.transaction(async transaction => {
      const order = await Orders.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      assert.equal(order.BuyerId, buyerId); assert.equal(order.SellerId, seller.UserId); assert.equal(order.Status, 'RESERVED');
      await order.update({ Status: 'WAITING_PAYMENT' }, { transaction });
      await StatusHistories.create({ OrderId: id, StatusType: 'ORDER', StatusValue: 'WAITING_PAYMENT', ChangedBy: seller.UserId, Note: 'D04 local fixture: simulate C06 acceptance (C06 API absent).' }, { transaction });
    });
    if (reported) await report(id);
  }
  return { id, listingId: listing.ListingId };
}
async function counts(id) {
  return {
    paymentHistory: await StatusHistories.count({ where: { OrderId: id, StatusType: 'PAYMENT' } }),
    paidHistory: await StatusHistories.count({ where: { OrderId: id, StatusType: 'ORDER', StatusValue: 'PAID' } }),
    buyerNotifications: await Notifications.count({ where: { UserId: buyerId, ReferenceType: 'ORDER', ReferenceId: id, Type: 'PAYMENT' } }),
    commissions: await Commissions.count({ where: { OrderId: id } }),
  };
}

async function guard() {
  const container = JSON.parse(execFileSync('docker', ['inspect', 'web1-chodocu-mysql-1'], { encoding: 'utf8' }))[0];
  assert.equal(container.Config.Labels['com.docker.compose.project'], 'web1-chodocu');
  assert(container.Mounts.some(m => m.Name === 'web1-chodocu_mysql_data' && m.Destination === '/var/lib/mysql'));
  assert(container.HostConfig.PortBindings['3306/tcp'].some(p => p.HostPort === '33307' && p.HostIp === '127.0.0.1'));
  const uuid = execFileSync('docker', ['exec', 'web1-chodocu-mysql-1', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names -e "SELECT @@server_uuid"'], { encoding: 'utf8' }).trim();
  assert.equal(sequelize.config.host, '127.0.0.1'); assert.equal(Number(sequelize.config.port), 33307); assert.equal(sequelize.config.database, 'cho_do_cu');
  const [server] = await sequelize.query('SELECT @@server_uuid AS uuid'); assert.equal(server[0].uuid, uuid);
  const [migrationRows] = await sequelize.query('SELECT name FROM SequelizeMeta');
  const expected = (await fs.readdir(path.resolve(__dirname, '../../migrations'))).filter(name => name.endsWith('.js')).sort();
  assert.deepEqual(migrationRows.map(row => row.name).sort(), expected);
  const demo = await Users.findByPk(buyerId, { include: [{ model: Roles, as: 'Roles' }] });
  assert(demo && demo.Status === 'ACTIVE' && !demo.Roles.some(role => role.RoleName === 'ADMIN'));
  const sellerRole = await Roles.findOne({ where: { RoleName: 'SELLER' } }); assert(sellerRole);
  seller = await Users.findOne({ where: { Username: 'D04_local_seller' } });
  if (!seller) {
    seller = await sequelize.transaction(async transaction => {
      const user = await Users.create({ Username: 'D04_local_seller', FullName: 'D04 Local Seller', Email: 'd04-local-seller@example.invalid', Status: 'ACTIVE', EmailVerified: true, PhoneVerified: true }, { transaction });
      await UserRoles.create({ UserId: user.UserId, RoleId: sellerRole.RoleId }, { transaction });
      await Store.create({ OwnerId: user.UserId, StoreName: 'D04 local fixture store', BankName: 'LOCAL TEST BANK', BankAccountNumber: '000123456789', BankAccountHolder: 'D04 LOCAL SELLER', Status: 'ACTIVE' }, { transaction });
      return user;
    });
  }
  const store = await Store.findOne({ where: { OwnerId: seller.UserId } }); assert(store);
  const profile = await Users.findByPk(seller.UserId, { include: [{ model: Roles, as: 'Roles' }] });
  assert(profile.Status === 'ACTIVE' && profile.Roles.some(role => role.RoleName === 'SELLER') && !profile.Roles.some(role => role.RoleName === 'ADMIN'));
  seller.StoreId = store.StoreId;
  category = await Categories.findOne({ where: { Status: 'ACTIVE' } }); assert(category);
  assert.equal((await fetch('http://127.0.0.1:3001/api/health')).status, 200);
  console.log(`GUARD PASS local DB UUID=${uuid}; 33307/cho_do_cu; migrations=${expected.length}; buyer=${buyerId}; selected fixture seller=${seller.UserId}`);
}

async function sqlAndApi() {
  const rejected = await createFixture('reject-resubmit');
  const first = await info(rejected.id), deadline = (await Orders.findByPk(rejected.id)).ReservedUntil.toISOString();
  for (const uid of [buyerId, 2, 3]) {
    assert.equal((await request(`/seller/orders/${rejected.id}/payment`, { 'x-user-id': String(uid) })).status, 403);
    assert.equal((await request(`/seller/orders/${rejected.id}/payment`, { 'x-user-id': String(uid) }, 'PATCH', sellerBody(first))).status, 403);
  }
  assert.equal((await request(`/seller/orders/${rejected.id}/payment`, buyerHeaders)).status, 401);
  const rejectedBody = sellerBody(first, 'REJECT', 'Chưa tìm thấy giao dịch trong ngân hàng.');
  assert.equal((await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', rejectedBody)).status, 200);
  const rejectedInfo = await info(rejected.id);
  assert.equal(rejectedInfo.orderStatus, 'WAITING_PAYMENT'); assert.equal(rejectedInfo.paymentStatus, 'REJECTED'); assert.equal(rejectedInfo.confirmedBy, null); assert.equal(rejectedInfo.confirmedAt, null);
  assert.equal(rejectedInfo.proofUrl, first.proofUrl); assert.deepEqual(rejectedInfo.bank, first.bank);
  const beforeRetry = await counts(rejected.id);
  assert.equal((await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', rejectedBody)).body.data.alreadyApplied, true);
  assert.deepEqual(await counts(rejected.id), beforeRetry);
  await report(rejected.id); const second = await info(rejected.id);
  assert.notEqual(second.reportVersion, first.reportVersion); assert.notEqual(second.proofUrl, first.proofUrl); assert.equal(second.paymentId, first.paymentId);
  assert.deepEqual(second.bank, first.bank);
  const stale = await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(first)); assert.equal(stale.status, 409); assert.equal(stale.body.code, 'PAYMENT_REPORT_CHANGED');
  const confirmBody = sellerBody(second, 'CONFIRM', 'Đã đối chiếu đủ tiền sản phẩm.');
  const confirmed = await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', confirmBody); assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const confirmedInfo = await info(rejected.id); assert.equal(confirmedInfo.orderStatus, 'PAID'); assert.equal(confirmedInfo.paymentStatus, 'CONFIRMED'); assert.equal(confirmedInfo.confirmedBy, seller.UserId);
  assert.equal((await Orders.findByPk(rejected.id)).ReservedUntil.toISOString(), deadline);
  const confirmedAt = confirmedInfo.confirmedAt, before = await counts(rejected.id);
  assert.deepEqual(before, { paymentHistory: 4, paidHistory: 1, buyerNotifications: 2, commissions: 0 });
  assert.equal((await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', confirmBody)).body.data.alreadyApplied, true);
  assert.equal((await info(rejected.id)).confirmedAt, confirmedAt); assert.deepEqual(await counts(rejected.id), before);
  assert.equal((await request(`/seller/orders/${rejected.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(second, 'REJECT'))).status, 409);
  assert.equal((await request(`/orders/${rejected.id}/cancellation-preview`, buyerHeaders)).body.data.action, 'REFUND');
  assert.equal((await request(`/orders/${rejected.id}/payment-info`, buyerHeaders)).body.data.policy.code, 'PAYMENT_CONFIRMED');

  const race = await createFixture('opposite-race'), raceInfo = await info(race.id);
  const results = await Promise.all(['CONFIRM', 'REJECT'].map(action => request(`/seller/orders/${race.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(raceInfo, action))));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal((await counts(race.id)).buyerNotifications, 1);

  const rollback = await createFixture('rollback'), rollbackInfo = await info(rollback.id), rollbackCounts = await counts(rollback.id);
  const failing = d04.createConfirmationService({ repository: { ...d04Repository, notifyBuyer: async () => { throw new Error('D04 fixture forced SQL rollback'); } } });
  await assert.rejects(failing.decide(rollback.id, sellerBody(rollbackInfo), { UserId: seller.UserId }), /forced SQL rollback/);
  assert.equal((await Payments.findOne({ where: { OrderId: rollback.id } })).Status, 'REPORTED'); assert.equal((await Orders.findByPk(rollback.id)).Status, 'WAITING_PAYMENT'); assert.deepEqual(await counts(rollback.id), rollbackCounts);

  const noPayment = await createFixture('no-payment', { reported: false });
  assert.equal((await info(noPayment.id)).paymentId, null);
  assert.equal((await request(`/orders/${noPayment.id}/payment-info`, buyerHeaders)).body.data.paymentStatus, 'WAITING');
  assert.equal((await info(noPayment.id)).policy.canDecide, false);
  assert.equal((await request(`/seller/orders/${noPayment.id}/payment`, sellerHeaders(), 'PATCH', { action: 'CONFIRM', reportVersion: 'a'.repeat(64) })).status, 409);

  const cancelRace = await createFixture('confirm-cancel-race'), cancelInfo = await info(cancelRace.id);
  const cancelResults = await Promise.all([
    request(`/seller/orders/${cancelRace.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(cancelInfo)),
    request(`/orders/${cancelRace.id}/cancel`, buyerHeaders, 'PATCH', { reason: 'Local test cancel race' }),
  ]);
  assert.deepEqual(cancelResults.map(r => r.status), [200, 409]); assert.equal((await Orders.findByPk(cancelRace.id)).Status, 'PAID');

  const cancelled = await createFixture('reject-then-cancel'); const cancelledInfo = await info(cancelled.id);
  assert.equal((await request(`/seller/orders/${cancelled.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(cancelledInfo, 'REJECT'))).status, 200);
  assert.equal((await request(`/orders/${cancelled.id}/cancel`, buyerHeaders, 'PATCH', { reason: 'Local test rejected cancellation' })).status, 200);
  assert.equal((await Listings.findByPk(cancelled.listingId)).Status, 'ACTIVE');
  assert.equal((await request(`/seller/orders/${cancelled.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(cancelledInfo))).status, 409);

  const refundRace = await createFixture('confirm-refund-race'), refundInfo = await info(refundRace.id);
  const refundBody = { reason: 'Sản phẩm bị lỗi, hư hỏng', refundBankCode: '970436', refundAccountNumber: '1234567890', refundAccountHolder: 'D04 LOCAL BUYER' };
  const refundResults = await Promise.all([
    request(`/seller/orders/${refundRace.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(refundInfo)),
    request(`/orders/${refundRace.id}/refund-requests`, { 'x-user-id': String(buyerId) }, 'POST', refundBody),
  ]);
  assert.equal(refundResults[0].status, 200);
  if (refundResults[1].status !== 201) {
    assert.equal(refundResults[1].status, 400); assert.equal((await request(`/orders/${refundRace.id}/refund-requests`, { 'x-user-id': String(buyerId) }, 'POST', refundBody)).status, 201);
  }
  assert.equal((await Orders.findByPk(refundRace.id)).Status, 'REFUND_PENDING');
  assert.equal(await RefundRequests.count({ where: { OrderId: refundRace.id } }), 1);
  assert.equal((await request(`/seller/orders/${refundRace.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(refundInfo))).status, 409);
  const refund = await RefundRequests.findOne({ where: { OrderId: refundRace.id } });
  const reviewResults = await Promise.all([
    request(`/refund-requests/${refund.RefundRequestId}`, { 'x-user-id': '2' }, 'PATCH', { action: 'REVIEW', expectedStatus: 'PENDING' }),
    request(`/seller/orders/${refundRace.id}/payment`, sellerHeaders(), 'PATCH', sellerBody(refundInfo)),
  ]);
  assert.deepEqual(reviewResults.map(r => r.status), [200, 409]);
  assert.equal((await RefundRequests.findByPk(refund.RefundRequestId)).Status, 'REVIEWING');

  // Test real expiration job on one newly created RESERVED fixture; PAID fixture
  // is also past deadline to prove it is not cancelled. No business rule changes.
  const expired = await createFixture('expiry', { accept: false });
  await Orders.update({ ReservedUntil: new Date(Date.now() - 60000) }, { where: { OrderId: [expired.id, rejected.id] } });
  await job.runOnce(); await job.runOnce();
  assert.equal((await Orders.findByPk(expired.id)).Status, 'CANCELLED'); assert.equal((await Listings.findByPk(expired.listingId)).Status, 'ACTIVE');
  assert.equal(await StatusHistories.count({ where: { OrderId: expired.id, StatusValue: 'CANCELLED' } }), 1);
  assert.equal((await Orders.findByPk(rejected.id)).Status, 'PAID');
  const list = await request('/seller/orders/payments?status=ALL&limit=2', sellerHeaders()); assert.equal(list.status, 200); assert.equal(list.body.data.length, 2); assert(list.body.pagination.totalPages > 1);
  for (const row of list.body.data) assert.equal((await Orders.findByPk(row.orderId)).SellerId, seller.UserId);
  console.log(`PASS real MySQL/API: reject/resubmit/stale/confirm/retry, opposite decisions, rollback, D02 cancel, B06 refund race, D01 expiry, scoped pagination. Example PAID=${rejected.id}`);
  return { confirmedId: rejected.id, readyId: rollback.id };
}

async function productionBrowser() {
  const { chromium } = require(process.env.D01_PLAYWRIGHT_PATH || 'playwright');
  const ui = await createFixture('browser-cycle', { reported: false });
  const lost = await createFixture('browser-lost-response');
  const mobile = await createFixture('browser-mobile');
  const secret = crypto.randomBytes(48).toString('hex');
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', JWT_SECRET: secret });
  const app = require('../../src/app');
  const api = app.listen(0, '127.0.0.1'); await new Promise(resolve => api.once('listening', resolve));
  const dist = path.resolve(__dirname, '../../../frontend/dist');
  const web = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const forwarded = http.request({ host: '127.0.0.1', port: api.address().port, path: req.url, method: req.method, headers: req.headers }, upstream => { res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res); });
      forwarded.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(forwarded); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const target = path.resolve(dist, '.' + pathname); assert(target.startsWith(dist + path.sep) || target === dist);
      let file = target;
      try { if (!(await fs.stat(file)).isFile()) file = path.join(dist, 'index.html'); } catch { file = path.join(dist, 'index.html'); }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file));
    } catch { res.writeHead(400); res.end(); }
  });
  web.listen(0, '127.0.0.1'); await new Promise(resolve => web.once('listening', resolve));
  const origin = `http://127.0.0.1:${web.address().port}`;
  const token = id => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
    return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
  };
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const buyer = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    const owner = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    await buyer.addInitScript(value => localStorage.setItem('accessToken', value), token(buyerId));
    await owner.addInitScript(value => localStorage.setItem('accessToken', value), token(seller.UserId));
    const buyerPage = await buyer.newPage(), ownerPage = await owner.newPage(), stalePage = await owner.newPage();
    const pageErrors = []; for (const page of [buyerPage, ownerPage, stalePage]) page.on('pageerror', e => pageErrors.push(e.message));
    await buyerPage.goto(`${origin}/orders/${ui.id}/payment`);
    await buyerPage.getByText('Mã QR của người bán sẽ được cập nhật sau.', { exact: true }).waitFor();
    const upload = async () => {
      await buyerPage.getByLabel('Biên lai chuyển khoản *', { exact: true }).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() });
      const response = buyerPage.waitForResponse(r => r.url().endsWith('/payment-notice') && r.request().method() === 'POST');
      await buyerPage.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click(); assert.equal((await response).status(), 200);
    };
    await upload();
    await ownerPage.goto(`${origin}/seller/payments`);
    await ownerPage.getByRole('heading', { name: 'Xác nhận nhận tiền', exact: true }).waitFor();
    await ownerPage.getByRole('link', { name: new RegExp(`Đơn #${ui.id} `) }).click();
    await stalePage.goto(`${origin}/seller/orders/${ui.id}/payment`);
    await stalePage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).waitFor();
    await ownerPage.getByLabel('Ghi chú đối chiếu', { exact: true }).fill('Chưa thấy giao dịch, kiểm tra lại biên lai.');
    const decide = async (page, label, expectedStatus = 200) => {
      await page.getByRole('button', { name: label, exact: true }).click();
      const response = page.waitForResponse(r => r.url().endsWith('/payment') && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Lưu kết quả đối chiếu', exact: true }).click(); const sent = await response; assert.equal(sent.status(), expectedStatus); return sent.json();
    };
    await decide(ownerPage, 'Chưa nhận được tiền');
    await buyerPage.reload(); await upload();
    await decide(stalePage, 'Đã nhận đủ tiền', 409);
    await stalePage.getByRole('alert').filter({ hasText: 'Đã tải trạng thái mới nhất' }).waitFor();
    await ownerPage.getByRole('button', { name: 'Tải lại', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).waitFor();
    await ownerPage.getByLabel('Ghi chú đối chiếu', { exact: true }).fill('Đã vào ngân hàng đủ tiền sản phẩm.');
    let patchCount = 0; ownerPage.on('request', r => { if (r.method() === 'PATCH') patchCount++; });
    const result = await decide(ownerPage, 'Đã nhận đủ tiền'); assert.equal(result.data.orderStatus, 'PAID'); assert.equal(result.data.paymentStatus, 'CONFIRMED');
    await ownerPage.getByRole('status').filter({ hasText: `Đã xác nhận nhận tiền cho đơn #${ui.id}.` }).waitFor();
    assert.equal(patchCount, 1);
    await ownerPage.reload(); await ownerPage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).waitFor(); assert.equal(await ownerPage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).isDisabled(), true);
    await buyerPage.reload(); await buyerPage.getByText('Người bán đã xác nhận nhận tiền', { exact: true }).first().waitFor();
    assert.equal((await Payments.findOne({ where: { OrderId: ui.id } })).ConfirmedBy, seller.UserId);
    assert.equal((await counts(ui.id)).buyerNotifications, 2); assert.equal((await counts(ui.id)).commissions, 0);

    await ownerPage.goto(`${origin}/seller/orders/${lost.id}/payment`);
    await ownerPage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).waitFor();
    await ownerPage.route(`**/seller/orders/${lost.id}/payment`, async route => {
      if (route.request().method() !== 'PATCH') { await route.continue(); return; }
      const forwarded = await route.fetch(); assert.equal(forwarded.status(), 200); await route.abort('failed');
    });
    await ownerPage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Lưu kết quả đối chiếu', exact: true }).click();
    await ownerPage.getByRole('status').filter({ hasText: 'Trạng thái thanh toán đã được cập nhật trước đó.' }).waitFor();
    assert.equal((await counts(lost.id)).buyerNotifications, 1); assert.equal((await counts(lost.id)).paidHistory, 1);
    const screenshot = path.join(os.tmpdir(), 'WEB1-D04-desktop.png'); await ownerPage.screenshot({ path: screenshot, fullPage: true }); console.log(`SCREENSHOT ${screenshot}`);

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mobileContext.addInitScript(value => localStorage.setItem('accessToken', value), token(seller.UserId));
    const mobilePage = await mobileContext.newPage(); mobilePage.on('pageerror', e => pageErrors.push(e.message));
    await mobilePage.goto(`${origin}/seller/orders/${mobile.id}/payment`);
    await mobilePage.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).waitFor();
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const mobileScreenshot = path.join(os.tmpdir(), 'WEB1-D04-mobile.png'); await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true }); console.log(`SCREENSHOT ${mobileScreenshot}`);
    assert.deepEqual(pageErrors, []);
    assert.equal((await owner.request.get(`${origin}/api/v1/seller/orders/${mobile.id}/payment`, { headers: { 'x-user-id': String(seller.UserId) } })).status(), 401);
    console.log(`PASS production bundle + production-auth local API/DB: JWT buyer/seller, D03 upload, D04 entry/list/detail/reject/resubmit/stale/confirm/reload, lost-response recovery, mobile, no page errors. UI PAID=${ui.id}; pending seller test=${mobile.id}`);
  } finally {
    if (browser) await browser.close();
    api.closeAllConnections(); web.closeAllConnections();
    await Promise.all([new Promise(resolve => api.close(resolve)), new Promise(resolve => web.close(resolve))]);
  }
}

(async () => {
  try {
    await guard();
    const result = await sqlAndApi();
    if (process.env.D04_BROWSER_TEST === 'true') await productionBrowser();
    console.log(`LOCAL FIXTURES retained: seller=${seller.UserId}, buyer=${buyerId}, readyOrder=${result.readyId}, paidOrder=${result.confirmedId}, createdOrders=${fixtureCount}. No schema/reset/seed/CD changes.`);
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
