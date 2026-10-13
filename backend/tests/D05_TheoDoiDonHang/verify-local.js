'use strict';
// Opt-in local fixtures only. No reset/migration/seed or CD/source checkout edits.
if (process.env.D05_LOCAL_TEST !== 'true') throw new Error('D05_LOCAL_TEST=true is required.');
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu', NODE_ENV: 'development' });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { QueryTypes } = require('sequelize');
const models = require('../../src/models');
const { sequelize, Users, Roles, UserRoles, Orders, Payments, RefundRequests, Listings, ListingMedia, Categories, Store, StatusHistories } = models;
const tracking = require('../../src/services/D05_TheoDoiDonHang/tracking.service');
const trackingRepository = require('../../src/repositories/D05_TheoDoiDonHang/tracking.repository');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
const base = 'http://localhost:5173/api/v1', runId = Date.now().toString(36), buyerId = 1;
const buyerHeaders = { 'x-d01-demo': 'true' };
let seller, store, category, otherBuyer, driver;
const fixtures = [];
async function request(url, headers = buyerHeaders, method = 'GET', body) {
  const res = await fetch(base + url, { method, headers: body && !(body instanceof FormData) ? { ...headers, 'content-type': 'application/json' } : headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function get(id, headers = buyerHeaders, query = '') {
  const result = await request(`/orders/${id}/tracking${query}`, headers);
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data;
}
async function account(username, role) {
  let user = await Users.findOne({ where: { Username: username } });
  if (!user) {
    const selected = await Roles.findOne({ where: { RoleName: role } }); assert(selected);
    user = await sequelize.transaction(async transaction => {
      const created = await Users.create({ Username: username, FullName: `D05 local ${role}`, Email: `${username}@example.invalid`, Status: 'ACTIVE' }, { transaction });
      await UserRoles.create({ UserId: created.UserId, RoleId: selected.RoleId }, { transaction }); return created;
    });
  }
  const profile = await Users.findByPk(user.UserId, { include: [{ model: Roles, as: 'Roles' }] });
  assert.equal(profile.Status, 'ACTIVE'); assert(profile.Roles.some(row => row.RoleName === role)); return user;
}
async function guard() {
  const container = JSON.parse(execFileSync('docker', ['inspect', 'web1-chodocu-mysql-1'], { encoding: 'utf8' }))[0];
  assert.equal(container.Config.Labels['com.docker.compose.project'], 'web1-chodocu');
  assert(container.Mounts.some(m => m.Name === 'web1-chodocu_mysql_data' && m.Destination === '/var/lib/mysql'));
  assert(container.HostConfig.PortBindings['3306/tcp'].some(p => p.HostPort === '33307' && p.HostIp === '127.0.0.1'));
  const uuid = execFileSync('docker', ['exec', 'web1-chodocu-mysql-1', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names -e "SELECT @@server_uuid"'], { encoding: 'utf8' }).trim();
  assert.equal(sequelize.config.host, '127.0.0.1'); assert.equal(Number(sequelize.config.port), 33307); assert.equal(sequelize.config.database, 'cho_do_cu');
  const [rows] = await sequelize.query('SELECT @@server_uuid AS uuid'); assert.equal(rows[0].uuid, uuid);
  const [applied] = await sequelize.query('SELECT name FROM SequelizeMeta');
  const expected = (await fs.readdir(path.resolve(__dirname, '../../migrations'))).filter(name => name.endsWith('.js')).sort();
  assert.deepEqual(applied.map(row => row.name).sort(), expected);
  assert.equal((await fetch('http://127.0.0.1:3001/api/health')).status, 200);
  const initial = await request('/orders?limit=1'); assert.equal(initial.status, 200, JSON.stringify(initial.body)); assert.equal(initial.body.viewer.userId, buyerId);
  seller = await Users.findOne({ where: { Username: 'D04_local_seller' } }); assert(seller && seller.Status === 'ACTIVE', 'Run existing D04 local fixture preparation first.');
  store = await Store.findOne({ where: { OwnerId: seller.UserId } }); assert(store);
  category = await Categories.findOne({ where: { Status: 'ACTIVE' } }); assert(category);
  // These writes happen only AFTER UUID/volume/port/schema/source API guards.
  otherBuyer = await account('D05_local_other_buyer', 'USER'); driver = await account('D05_local_driver', 'DRIVER');
  console.log(`GUARD PASS local UUID=${uuid}; DB33307; migrations=${expected.length}; buyer=${buyerId}, seller=${seller.UserId}, otherBuyer=${otherBuyer.UserId}, driver=${driver.UserId}`);
}
async function listing(label, active = false) {
  return Listings.create({ SellerId: seller.UserId, StoreId: store.StoreId, CategoryId: category.CategoryId, Title: `D05 local ${runId} ${label}`, Description: 'Local fixture only, no real payment. Missing C06/D06/delivery functions simulated only in this new fixture.', Price: active ? '123456.10' : '999999.00', ConditionLevel: 'GOOD', Status: active ? 'ACTIVE' : 'RESERVED' });
}
async function fixture(label, { status = 'PAID', method = 'PICKUP', payment = 'CONFIRMED', delivery = null, assigned = false, buyer = buyerId, history = true } = {}) {
  const product = await listing(label);
  const order = await Orders.create({ BuyerId: buyer, SellerId: seller.UserId, ListingId: product.ListingId, DeliveryMethod: method, ReceiverName: 'D05 receiver snapshot', ReceiverPhone: '0900000001', ReceiverAddress: method === 'DELIVERY' ? 'D05 delivery snapshot address' : null, ProductAmount: '123456.10', DeliveryFee: method === 'DELIVERY' ? '25000.00' : '0.00', TotalAmount: method === 'DELIVERY' ? '148456.10' : '123456.10', Status: status, ReservedUntil: new Date(Date.now() + 3600000), CancelReason: status === 'CANCELLED' ? 'D05 local fixture cancelled reason' : null, CompletedAt: status === 'COMPLETED' ? new Date() : null });
  if (payment) await Payments.create({ OrderId: order.OrderId, PayerId: buyer, PayeeId: seller.UserId, Amount: order.ProductAmount, BankName: store.BankName, BankAccountSnapshot: store.BankAccountNumber, BankAccountHolderSnapshot: store.BankAccountHolder, TransferContent: `THANH TOAN DON ${order.OrderId}`, Status: payment, ConfirmedBy: payment === 'CONFIRMED' ? seller.UserId : null, ConfirmedAt: payment === 'CONFIRMED' ? new Date() : null });
  const sqlNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (delivery) await sequelize.query(`INSERT INTO Deliveries (OrderId, DriverId, PickupAddress, DeliveryAddress, DriverFee, Status, PickupCodeHash, RetryCount, FailureReason, AcceptedAt, DeliveredAt) VALUES (:id,:driver,'D05 pickup snapshot',:address,'25000.00',:status,'LOCAL_D05_SECRET_HASH',:retry,:reason,:accepted,:delivered)`, { replacements: { id: order.OrderId, driver: assigned ? driver.UserId : null, address: order.ReceiverAddress, status: delivery, retry: ['FAILED', 'RETURNING', 'RETURNED'].includes(delivery) ? 1 : 0, reason: ['FAILED', 'RETURNING', 'RETURNED'].includes(delivery) ? 'D05 fixture receiver unavailable' : null, accepted: assigned ? sqlNow : null, delivered: delivery === 'DELIVERED' ? sqlNow : null } });
  if (['REFUND_PENDING', 'REFUNDED'].includes(status)) await RefundRequests.create({ OrderId: order.OrderId, RequestedBy: buyer, Reason: 'D05 local refund fixture', Amount: '123456.10', Status: status === 'REFUNDED' ? 'COMPLETED' : 'REVIEWING', OrderStatusBefore: 'PAID', CompletedAt: status === 'REFUNDED' ? new Date() : null });
  if (history) await StatusHistories.create({ OrderId: order.OrderId, StatusType: 'ORDER', StatusValue: status, ChangedBy: buyer, Note: 'D05 local fixture state; upstream function not implemented.' });
  const result = { id: order.OrderId, listingId: product.ListingId, label }; fixtures.push(result); return result;
}
async function counts() {
  const result = {};
  for (const table of ['Orders', 'Payments', 'Deliveries', 'StatusHistories', 'Notifications', 'RefundRequests', 'Conversations', 'Commissions']) {
    const rows = await sequelize.query(`SELECT COUNT(*) AS n FROM ${table}`, { type: QueryTypes.SELECT }); result[table] = Number(rows[0].n);
  }
  return result;
}
async function notice(id) {
  const form = new FormData(); form.append('proof', new Blob([pngReceipt()], { type: 'image/png' }), 'd05-local-proof.png');
  const r = await request(`/orders/${id}/payment-notice`, buyerHeaders, 'POST', form); assert.equal(r.status, 200, JSON.stringify(r.body));
}
async function decision(id, action) {
  const headers = { 'x-user-id': String(seller.UserId) };
  const info = await request(`/seller/orders/${id}/payment`, headers); assert.equal(info.status, 200);
  const r = await request(`/seller/orders/${id}/payment`, headers, 'PATCH', { action, reportVersion: info.body.data.reportVersion, note: 'D05 integration bank reconciliation fixture only' }); assert.equal(r.status, 200, JSON.stringify(r.body));
}
async function sqlAndApi() {
  const product = await listing('D01 actual creation', true);
  const created = await request('/orders', buyerHeaders, 'POST', { listingId: product.ListingId, deliveryMethod: 'PICKUP', receiverName: 'D05 D01 buyer', receiverPhone: '0900000001' });
  assert.equal(created.status, 201, JSON.stringify(created.body)); const reserved = { id: created.body.data.orderId, listingId: product.ListingId }; fixtures.push(reserved);
  const waiting = await fixture('waiting-no-payment', { status: 'WAITING_PAYMENT', payment: null });
  const paid = await fixture('paid'), cancelled = await fixture('cancelled', { status: 'CANCELLED', payment: null });
  const refund = await fixture('refund-pending', { status: 'REFUND_PENDING' }), refunded = await fixture('refunded', { status: 'REFUNDED' });
  const noDriver = await fixture('delivery-no-driver', { method: 'DELIVERY' });
  const available = await fixture('delivery-available', { method: 'DELIVERY', delivery: 'AVAILABLE' });
  const assigned = await fixture('delivery-assigned', { status: 'IN_DELIVERY', method: 'DELIVERY', delivery: 'DELIVERING', assigned: true });
  const delivered = await fixture('delivered-not-completed', { status: 'DELIVERED', method: 'DELIVERY', delivery: 'DELIVERED', assigned: true });
  const failed = await fixture('delivery-failed', { status: 'IN_DELIVERY', method: 'DELIVERY', delivery: 'FAILED', assigned: true });
  const returned = await fixture('delivery-returning', { status: 'IN_DELIVERY', method: 'DELIVERY', delivery: 'RETURNING', assigned: true });
  const noHistory = await fixture('empty-history', { status: 'CANCELLED', payment: null, history: false });
  const other = await fixture('other-buyer', { buyer: otherBuyer.UserId });
  const tiedAt = new Date();
  await StatusHistories.bulkCreate(Array.from({ length: 25 }, (_, index) => ({ OrderId: assigned.id, StatusType: ['ORDER', 'PAYMENT', 'DELIVERY', 'REFUND'][index % 4], StatusValue: ['IN_DELIVERY', 'CONFIRMED', 'DELIVERING', 'REJECTED'][index % 4], CreatedAt: tiedAt, Note: index === 0 ? 'OTP 123456' : `D05 fixture history ${index}` })));
  await sequelize.query(`INSERT INTO Conversations (OrderId, CreatedBy, ConversationType) VALUES (:id,:buyer,'DIRECT_CHAT')`, { replacements: { id: assigned.id, buyer: buyerId } });
  await ListingMedia.create({ ListingId: assigned.listingId, MediaType: 'IMAGE', MediaUrl: '/product-placeholder.svg', SortOrder: 1 });
  const before = await counts();
  for (const f of fixtures.filter(f => f.id !== other.id)) {
    const data = await get(f.id);
    assert.equal(data.viewer.userId, buyerId); assert.equal(data.productAmount, '123456.10');
    assert(!JSON.stringify(data).includes('LOCAL_D05_SECRET_HASH')); assert(!JSON.stringify(data).includes('PasswordHash')); assert(!JSON.stringify(data).includes('BankAccountSnapshot'));
    await get(f.id); // Repeated reads do not mutate anything.
  }
  for (const status of ['RESERVED', 'WAITING_PAYMENT', 'PAID', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED']) { const r = await request(`/orders?status=${status}&limit=2`); assert.equal(r.status, 200); assert(r.body.data.every(o => o.orderStatus === status)); }
  assert.deepEqual(await counts(), before, 'D05 GET must not write any business table');
  assert.equal(await Payments.count({ where: { OrderId: waiting.id } }), 0);
  assert.equal((await get(reserved.id)).orderStatus, 'RESERVED'); assert.equal((await get(noHistory.id)).histories.length, 0);
  assert.equal((await get(paid.id)).capabilities.refund.enabled, false); assert.equal((await get(paid.id, { 'x-user-id': String(buyerId) })).capabilities.refund.href, `/orders/${paid.id}/refund`);
  assert.equal((await get(refund.id)).refunds[0].status, 'REVIEWING'); assert.equal((await get(refunded.id)).orderStatus, 'REFUNDED');
  assert.equal((await get(noDriver.id)).deliveries.length, 0); assert.equal((await get(available.id)).deliveries[0].driver, null);
  assert.equal((await get(delivered.id)).progress.label, 'Đã giao, chưa hoàn tất đơn');
  assert.equal((await get(failed.id)).progress.branch, 'DELIVERY_EXCEPTION'); assert.equal((await get(returned.id)).progress.branch, 'DELIVERY_EXCEPTION');
  const assignedInfo = await get(assigned.id); assert.equal(assignedInfo.deliveries[0].driver.userId, driver.UserId); assert.equal(assignedInfo.capabilities.chat.href, null); assert.equal(assignedInfo.histories.length, 20);
  const nextHistory = await get(assigned.id, buyerHeaders, '?historyPage=2&historyLimit=20'); assert(nextHistory.histories.length > 0); assert(assignedInfo.histories.at(-1).historyId < nextHistory.histories[0].historyId);
  assert(!JSON.stringify(assignedInfo).includes('OTP 123456'));
  assert.equal((await request(`/orders/${assigned.id}/tracking`, { 'x-user-id': '2' })).status, 403);
  assert.equal((await request(`/orders/${other.id}/tracking`)).status, 403);
  assert.equal((await request('/orders/4294967295/tracking')).status, 404);
  for (const query of ['?BuyerId=2', '?page=0', '?limit=1e2', '?sort=DROP', '?status=DELIVERING']) assert.equal((await request('/orders' + query)).status, 400);
  assert.equal((await get(assigned.id, { 'x-user-id': String(driver.UserId) })).productAmount, undefined);
  assert.equal((await request(`/orders/${noDriver.id}/tracking`, { 'x-user-id': String(driver.UserId) })).status, 403);
  const owned = await request('/orders', { 'x-user-id': String(otherBuyer.UserId) }); assert.equal(owned.status, 200); assert(owned.body.data.some(o => o.orderId === other.id)); assert(!owned.body.data.some(o => o.orderId === paid.id));
  const page1 = await request('/orders?limit=2'), page2 = await request('/orders?limit=2&page=2'); assert.equal(page1.body.data.length, 2); assert(!page1.body.data.some(a => page2.body.data.some(b => a.orderId === b.orderId)));
  const statements = [], originalLogging = sequelize.options.logging;
  sequelize.options.logging = statement => statements.push(statement);
  try { await tracking.getTracking(assigned.id, {}, { UserId: buyerId, roles: ['USER'] }); await tracking.listOrders({ limit: '2' }, { UserId: buyerId }); } finally { sequelize.options.logging = originalLogging; }
  assert(!statements.some(s => /FOR UPDATE|LOCK IN SHARE|\bINSERT\b|\bUPDATE\s+`|\bDELETE\b/i.test(s))); assert(statements.some(s => /REPEATABLE READ/i.test(s)));
  const queryCounts = [];
  for (const limit of ['1', '100']) {
    const sql = []; sequelize.options.logging = statement => sql.push(statement);
    try { await tracking.listOrders({ limit }, { UserId: buyerId }); } finally { sequelize.options.logging = originalLogging; }
    queryCounts.push(sql.filter(statement => /\bSELECT\b/.test(statement)).length);
  }
  assert.equal(queryCounts[0], queryCounts[1], 'Page size must not introduce per-order SQL queries');
  const initialVersion = (await get(waiting.id)).version;
  assert.equal((await request(`/orders/${waiting.id}/payment-info`)).status, 200); assert.equal((await get(waiting.id)).paymentStatus, 'WAITING');
  await notice(waiting.id); assert.equal((await get(waiting.id)).paymentStatus, 'REPORTED'); assert.notEqual((await get(waiting.id)).version, initialVersion);
  assert.equal((await get(waiting.id, { 'x-user-id': String(seller.UserId) })).capabilities.confirmPayment.href, `/seller/orders/${waiting.id}/payment`);
  await decision(waiting.id, 'REJECT'); assert.equal((await get(waiting.id)).paymentStatus, 'REJECTED'); assert.equal((await get(waiting.id)).capabilities.payment.href, `/orders/${waiting.id}/payment`);
  await notice(waiting.id); assert.equal((await get(waiting.id)).paymentStatus, 'REPORTED'); await decision(waiting.id, 'CONFIRM'); assert.equal((await get(waiting.id)).orderStatus, 'PAID');
  const snapshot = await fixture('snapshot-during-commit', { status: 'WAITING_PAYMENT', payment: null }); await notice(snapshot.id);
  const concurrentReader = tracking.createTrackingService({ repository: { ...trackingRepository, readState: async (id, transaction) => {
    const state = await trackingRepository.readState(id, transaction);
    // Real D04 commits after D05's first consistent read, without waiting for
    // a write lock held by D05. Remaining SELECTs must retain the old snapshot.
    await decision(id, 'CONFIRM'); return state;
  } } });
  const oldSnapshot = await concurrentReader.getTracking(snapshot.id, {}, { UserId: buyerId, roles: ['USER'] });
  assert.equal(oldSnapshot.orderStatus, 'WAITING_PAYMENT'); assert.equal(oldSnapshot.paymentStatus, 'REPORTED'); assert(!oldSnapshot.histories.some(h => h.status === 'CONFIRMED'));
  assert.equal((await get(snapshot.id)).orderStatus, 'PAID');
  const b06 = await fixture('B06-actual-integration');
  const refundCreated = await request(`/orders/${b06.id}/refund-requests`, { 'x-user-id': String(buyerId) }, 'POST', { reason: 'Khác', description: 'D05 local refund integration, no actual transfer.', refundBankCode: '970418', refundAccountNumber: '000123456789', refundAccountHolder: 'LOCAL TEST BUYER' });
  assert.equal(refundCreated.status, 201, JSON.stringify(refundCreated.body)); assert.equal((await get(b06.id)).orderStatus, 'REFUND_PENDING');
  assert.equal((await request(`/orders/${cancelled.id}/cancellation-preview`)).status, 200);
  console.log(`PASS local MySQL/API: read-only counts, SELECT snapshot/no locks, auth/privacy, all states, pagination/tied history, D01 creation, D03 resend+D04 confirmation, B06 capability. reserved=${reserved.id}, paid=${paid.id}, delivered=${delivered.id}, assigned=${assigned.id}`);
  return { reserved, waiting, paid, cancelled, refund, refunded, noDriver, assigned, delivered, other };
}
async function browserTest(examples) {
  const { chromium } = require(process.env.D05_PLAYWRIGHT_PATH || 'playwright');
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: String(buyerId), JWT_SECRET: crypto.randomBytes(32).toString('hex') });
  const app = require('../../src/app'), api = app.listen(0, '127.0.0.1'); await new Promise(resolve => api.once('listening', resolve));
  const dist = path.resolve(__dirname, '../../../frontend/dist'); await fs.access(path.join(dist, 'index.html'));
  const staticServer = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const proxy = http.request({ hostname: '127.0.0.1', port: api.address().port, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
      proxy.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(proxy); return;
    }
    try {
      const requested = path.resolve(dist, '.' + decodeURIComponent(req.url.split('?')[0]));
      const target = requested.startsWith(dist + path.sep) && path.extname(requested) ? requested : path.join(dist, 'index.html');
      const data = await fs.readFile(target); const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(target)] || 'application/octet-stream'; res.writeHead(200, { 'content-type': mime }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  staticServer.listen(0, '127.0.0.1'); await new Promise(resolve => staticServer.once('listening', resolve));
  const origin = `http://127.0.0.1:${staticServer.address().port}`;
  const token = id => { const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url'); const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })}`; return `${data}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url')}`; };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const errors = [], context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(value => localStorage.setItem('accessToken', value), token(buyerId));
    await page.goto(origin + '/orders'); await page.getByRole('heading', { name: 'Đơn mua của tôi', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Xem chi tiết', exact: true }).first().waitFor();
    await page.getByLabel('Lọc trạng thái đơn').selectOption('REFUNDED'); await page.getByRole('link', { name: new RegExp(`Đơn #${examples.refunded.id} ·`) }).waitFor();
    await page.goto(`${origin}/orders/${examples.delivered.id}/tracking`); await page.getByRole('heading', { name: 'Đã giao, chưa hoàn tất đơn', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Xác nhận nhận hàng', exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Yêu cầu hoàn tiền', exact: true }).click(); await page.getByRole('heading', { name: `Yêu cầu hoàn tiền cho đơn #${examples.delivered.id}` }).waitFor();
    await page.getByRole('link', { name: 'Quay lại theo dõi đơn hàng', exact: true }).click(); await page.getByRole('heading', { name: 'Đã giao, chưa hoàn tất đơn', exact: true }).waitFor();
    await page.goto(`${origin}/orders/${examples.assigned.id}/tracking`); await page.getByRole('heading', { name: 'Lịch sử tiến trình', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Liên hệ tài xế', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'WEB1-D05-desktop.png'), fullPage: true });
    // Actual server-side change while the page is open: only our new local fixture.
    await sequelize.transaction(async transaction => {
      await Orders.update({ Status: 'DELIVERED' }, { where: { OrderId: examples.assigned.id }, transaction });
      await StatusHistories.create({ OrderId: examples.assigned.id, StatusType: 'ORDER', StatusValue: 'DELIVERED', Note: 'D05 local UI state-change fixture', CreatedAt: new Date() }, { transaction });
    });
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await page.getByText(`Đơn #${examples.assigned.id} đã chuyển sang Đã giao.`, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await page.getByRole('heading', { name: 'Đã giao, chưa hoàn tất đơn', exact: true }).waitFor();
    assert.equal(await page.getByText(`Đơn #${examples.assigned.id} đã chuyển sang Đã giao.`, { exact: true }).count(), 0);
    await page.route('**/api/v1/orders/*/tracking*', route => route.abort()); await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await page.getByText('Không kết nối được máy chủ', { exact: true }).waitFor();
    await page.unroute('**/api/v1/orders/*/tracking*'); await page.getByRole('button', { name: /Thử lại/ }).click(); await page.getByRole('heading', { name: 'Đã giao, chưa hoàn tất đơn', exact: true }).waitFor();
    await page.goto(`${origin}/orders/${examples.other.id}/tracking`); await page.getByText('Bạn không có quyền theo dõi đơn hàng này.', { exact: true }).waitFor();
    await page.goto(`${origin}/orders/not-an-id/tracking`); await page.getByText('Mã đơn hàng không hợp lệ.', { exact: true }).waitFor();
    const demo = await browser.newContext({ viewport: { width: 390, height: 844 } }), mobile = await demo.newPage(); mobile.on('pageerror', e => errors.push(e.message));
    await mobile.goto(`${origin}/orders/${examples.noDriver.id}/tracking`); await mobile.getByRole('heading', { name: 'Đã thanh toán · chờ giao nhận', exact: true }).waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await mobile.getByRole('button', { name: 'Mở menu', exact: true }).click(); await mobile.getByRole('link', { name: 'Đơn mua của tôi', exact: true }).first().waitFor();
    await mobile.getByRole('button', { name: 'Đóng menu', exact: true }).click();
    await mobile.screenshot({ path: path.join(os.tmpdir(), 'WEB1-D05-mobile.png'), fullPage: true });
    await mobile.goto(`${origin}/orders/${examples.reserved.id}/tracking`); await mobile.getByRole('heading', { name: 'Chờ người bán chấp nhận', exact: true }).waitFor();
    await mobile.getByRole('link', { name: 'Hủy đơn', exact: true }).click(); await mobile.getByRole('heading', { name: 'Hủy đơn hàng', exact: true }).waitFor();
    await mobile.getByRole('link', { name: 'Theo dõi đơn hàng', exact: true }).click(); await mobile.getByRole('heading', { name: 'Chờ người bán chấp nhận', exact: true }).waitFor();
    const sellerContext = await browser.newContext(); await sellerContext.addInitScript(value => localStorage.setItem('accessToken', value), token(seller.UserId));
    const sellerPage = await sellerContext.newPage();
    const sellerPending = await fixture('seller-pending', { status: 'WAITING_PAYMENT', payment: null }); await notice(sellerPending.id);
    await sellerPage.goto(`${origin}/orders/${sellerPending.id}/tracking`); await sellerPage.getByRole('link', { name: 'Xác nhận nhận tiền', exact: true }).click(); await sellerPage.getByRole('heading', { name: `Xác nhận nhận tiền · Đơn #${sellerPending.id}` }).waitFor();
    const waiting = await fixture('buyer-pending', { status: 'WAITING_PAYMENT', payment: null });
    await page.goto(`${origin}/orders/${waiting.id}/tracking`); await page.getByRole('link', { name: 'Thanh toán / Báo chuyển tiền', exact: true }).click(); await page.getByRole('heading', { name: 'Thanh toán cho người bán', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Khu vực QR người bán').locator('img').count(), 0);
    await page.getByRole('link', { name: 'Theo dõi đơn hàng', exact: true }).click(); await page.getByRole('heading', { name: 'Chờ thanh toán', exact: true }).waitFor();
    // D01 real browser form -> backend-created ID -> tracking. No bank transfer.
    const purchase = await listing('browser-D01', true);
    await mobile.goto(`${origin}/orders/create/${purchase.ListingId}`);
    await mobile.locator('#receiver-name').fill('D05 browser buyer'); await mobile.locator('#receiver-phone').fill('0900000001');
    const createdOrderResponse = mobile.waitForResponse(response => response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST');
    await mobile.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).click();
    const createdOrder = await (await createdOrderResponse).json(); assert(createdOrder.data.orderId);
    await mobile.getByRole('button', { name: 'Theo dõi đơn hàng', exact: true }).click();
    await mobile.getByRole('heading', { name: `Theo dõi đơn hàng #${createdOrder.data.orderId}`, exact: true }).waitFor();
    // Countdown reloads from server once at zero, never changes status locally.
    const expiring = await fixture('countdown', { status: 'RESERVED', payment: null });
    await Orders.update({ ReservedUntil: new Date(Date.now() + 2500) }, { where: { OrderId: expiring.id } });
    let expiryRequests = 0; mobile.on('request', req => { if (req.url().includes(`/orders/${expiring.id}/tracking`)) expiryRequests++; });
    await mobile.goto(`${origin}/orders/${expiring.id}/tracking`);
    await new Promise(resolve => setTimeout(resolve, 4500));
    assert(expiryRequests >= 2 && expiryRequests <= 3, `Expiry must not cause a reload loop: ${expiryRequests}`);
    const actualExpiry = await get(expiring.id);
    await mobile.getByRole('heading', { name: actualExpiry.orderStatus === 'CANCELLED' ? 'Đơn đã hủy' : 'Chờ người bán chấp nhận', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal((await fetch(`${origin}/api/v1/orders/${examples.reserved.id}/tracking`, { headers: { 'x-user-id': String(buyerId) } })).status, 401);
    console.log(`PASS production build + actual local production-auth API: JWT+buyer demo, mobile/desktop, errors/offline/retry/state changes/no repeated notice, D02/D03/D04/refund links; ready seller order=${sellerPending.id}; screenshots in OS temp.`);
  } finally { await browser.close(); staticServer.closeAllConnections(); await new Promise(resolve => staticServer.close(resolve)); api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
}
(async () => {
  try {
    await guard();
    const examples = process.env.D05_EXISTING_EXAMPLES ? JSON.parse(process.env.D05_EXISTING_EXAMPLES) : await sqlAndApi();
    // Retry visual verification without preparing the same SQL scenarios again.
    if (process.env.D05_EXISTING_EXAMPLES) for (const item of Object.values(examples)) {
      const row = await Orders.findByPk(item.id, { include: [{ model: Listings, as: 'Listing', attributes: ['Title'] }] });
      assert(row && row.SellerId === seller.UserId && row.Listing.Title.startsWith('D05 local '), 'Reuse only guarded local D05 fixtures.');
    }
    if (process.env.D05_BROWSER_TEST === 'true') await browserTest(examples);
    console.log(`LOCAL fixtures retained: ${JSON.stringify(examples)}; buyer=${buyerId}, seller=${seller.UserId}, otherBuyer=${otherBuyer.UserId}, driver=${driver.UserId}.`);
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
