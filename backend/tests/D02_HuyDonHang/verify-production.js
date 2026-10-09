'use strict';

// Kiểm thử bundle production với controller/service/SQL thật. Toàn bộ fixture
// nằm trong một transaction rollback; không start job, migrate, seed hoặc CD.
require('dotenv').config();
Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true' });
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { chromium } = require(process.env.D01_PLAYWRIGHT_PATH || 'playwright');
const { Op } = require('sequelize');
const models = require('../../src/models');
const { sequelize, Users, Categories, Listings, Orders, Payments, RefundRequests, StatusHistories, Notifications } = models;
const d01 = require('../../src/repositories/order.repository');
const d02 = require('../../src/repositories/D02_HuyDonHang/cancellation.repository');

function token(userId) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  return `${h}.${p}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}

async function main() {
  let tx, browser;
  const servers = [];
  const fixtureListingIds = [];
  const original = { transaction: sequelize.transaction, d01Transaction: d01.withTransaction, d02Transaction: d02.withTransaction, preview: d01.findListingPreview, refundRead: RefundRequests.findByPk, refundList: RefundRequests.findAndCountAll };
  let fixtureOrderIds = [];
  try {
    const demoId = Number(process.env.D01_DEMO_USER_ID);
    const buyer = await Users.findByPk(demoId, { include: [{ association: 'Roles' }] });
    assert.ok(buyer?.Status === 'ACTIVE' && !buyer.Roles.some(r => r.RoleName === 'ADMIN'), 'Cần D01_DEMO_USER_ID đang ACTIVE, không ADMIN.');
    const seller = await Users.findOne({ where: { UserId: { [Op.ne]: demoId }, Status: 'ACTIVE' }, include: [{ association: 'Roles', where: { RoleName: 'SELLER' } }] });
    const admin = await Users.findOne({ where: { Status: 'ACTIVE' }, include: [{ association: 'Roles', where: { RoleName: 'ADMIN' } }] });
    assert.ok(seller && admin, 'Cần tài khoản SELLER/ADMIN có sẵn để kiểm thử B06–B07, không seed.');
    tx = await original.transaction.call(sequelize);
    const category = await Categories.create({ CategoryName: `D02 rollback ${Date.now()}`, Status: 'ACTIVE' }, { transaction: tx });
    async function newListing() {
      const row = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: 'D02 production rollback fixture', Description: 'Dữ liệu kiểm thử sẽ rollback.', Price: '123456.00', ConditionLevel: 'GOOD', Status: 'ACTIVE' }, { transaction: tx });
      fixtureListingIds.push(row.ListingId); return row;
    }
    const first = await newListing();
    // Chỉ tiến trình kiểm thử tham gia outer transaction để thấy fixture chưa commit.
    d01.withTransaction = d02.withTransaction = work => work(tx);
    d01.findListingPreview = id => original.preview(id, tx);
    sequelize.transaction = (options, work) => (typeof options === 'function' ? options : work)(tx);
    // B07 đọc lại response sau transaction và B06 danh sách cũng cần thấy fixture
    // chưa commit; vẫn query SQL thật, chỉ bổ sung transaction của test.
    RefundRequests.findByPk = (id, options = {}) => original.refundRead.call(RefundRequests, id, { ...options, transaction: tx });
    RefundRequests.findAndCountAll = (options = {}) => original.refundList.call(RefundRequests, { ...options, transaction: tx });
    const app = require('../../src/app');
    for (const [port, out] of [[4182, 'demo-on'], [4183, 'demo-off']]) {
      const dist = path.resolve(__dirname, `../../../frontend/dist/${out}`);
      assert.ok(fs.existsSync(path.join(dist, 'index.html')), `Cần build ${out}.`);
      const site = express();
      site.use((req, res, next) => req.path.startsWith('/api/') ? app(req, res, next) : next());
      site.use(express.static(dist)); site.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
      const server = site.listen(port, '127.0.0.1'); servers.push(server);
      await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    }
    const origin = 'http://127.0.0.1:4182';
    browser = await chromium.launch({ headless: true, executablePath: process.env.D01_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let patches = 0;
    page.on('request', req => { if (req.method() === 'PATCH' && /\/cancel$/.test(req.url())) { patches++; assert.equal(req.headers()['x-d01-demo'], 'true'); assert.equal(req.headers().authorization, undefined); } });
    await page.goto(`${origin}/orders/create/${first.ListingId}`);
    await page.getByLabel('Họ và tên người nhận').fill('D02 Test');
    await page.getByLabel('Số điện thoại').fill('0901234567');
    await page.getByRole('button', { name: /Đặt hàng và giữ món/ }).click();
    await page.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục hủy đơn' }).waitFor();
    const id = Number(page.url().match(/\/orders\/(\d+)\/cancel/)[1]);
    await page.getByRole('button', { name: 'Tiếp tục hủy đơn' }).click();
    await page.getByText('Vui lòng chọn lý do hủy đơn.', { exact: true }).waitFor();
    await page.getByLabel('Lý do hủy đơn *', { exact: true }).selectOption('Khác');
    await page.getByLabel('Lý do khác *').fill('  Lý do D02 production  ');
    await page.getByRole('button', { name: 'Tiếp tục hủy đơn' }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy đơn' }).dblclick();
    await page.getByText(`Đơn #${id} đã được hủy.`, { exact: true }).first().waitFor();
    assert.equal(patches, 1);
    assert.equal((await Orders.findByPk(id, { transaction: tx })).CancelReason, 'Lý do D02 production');
    assert.equal((await Listings.findByPk(first.ListingId, { transaction: tx })).Status, 'ACTIVE');
    assert.equal(await StatusHistories.count({ where: { OrderId: id, StatusValue: 'CANCELLED' }, transaction: tx }), 1);
    assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: id }, transaction: tx }), 3);
    const repeat = await context.request.patch(`${origin}/api/v1/orders/${id}/cancel`, { headers: { 'x-d01-demo': 'true' }, data: { reason: 'Retry' } });
    assert.equal(repeat.status(), 200); assert.equal((await repeat.json()).data.alreadyCancelled, true);
    if (process.env.D02_SCREENSHOT_PATH) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: process.env.D02_SCREENSHOT_PATH, fullPage: true });
    }
    console.log(`PASS production demo: D01 -> D02 order #${id}; cancel 200/CANCELLED; reason trimmed; ACTIVE; 1 history/2 cancel notifications; double-click=1 PATCH.`);

    async function createFixtureOrder(status, paymentStatus) {
      const listing = await newListing();
      const result = await require('../../src/services/order.service').createOrder({ listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'D02 Fixture', receiverPhone: '0901234567' }, demoId);
      const order = await Orders.findByPk(result.data.orderId, { transaction: tx });
      await order.update({ Status: status }, { transaction: tx });
      if (paymentStatus) await Payments.create({ OrderId: order.OrderId, PayerId: demoId, PayeeId: seller.UserId, Amount: order.ProductAmount, TransferContent: `TEST${order.OrderId}`, Status: paymentStatus }, { transaction: tx });
      return { order, listing };
    }
    const reported = await createFixtureOrder('WAITING_PAYMENT', 'REPORTED');
    await page.goto(`${origin}/orders/${reported.order.OrderId}/cancel`);
    await page.getByText(/Đã báo chuyển tiền; cần người bán xác minh/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tiếp tục hủy đơn' }).count(), 0);
    assert.equal((await context.request.patch(`${origin}/api/v1/orders/${reported.order.OrderId}/cancel`, { headers: { 'x-d01-demo': 'true' }, data: { reason: 'Test' } })).status(), 409);
    assert.equal((await Listings.findByPk(reported.listing.ListingId, { transaction: tx })).Status, 'RESERVED');
    console.log('PASS production REPORTED: UI blocked, PATCH 409, listing remains RESERVED.');

    const paid = await createFixtureOrder('PAID', 'CONFIRMED');
    const signedContext = await browser.newContext();
    await signedContext.addInitScript(accessToken => localStorage.setItem('accessToken', accessToken), token(demoId));
    const signedPage = await signedContext.newPage();
    signedPage.on('pageerror', error => errors.push(error.message));
    await signedPage.goto(`${origin}/orders/${paid.order.OrderId}/cancel`);
    const link = signedPage.getByRole('link', { name: 'Tạo yêu cầu hoàn tiền' });
    await link.waitFor(); assert.equal(await link.getAttribute('href'), `/orders/${paid.order.OrderId}/refund`);
    await link.click();
    await signedPage.getByRole('heading', { name: `Yêu cầu hoàn tiền cho đơn #${paid.order.OrderId}` }).waitFor();
    assert.equal((await Orders.findByPk(paid.order.OrderId, { transaction: tx })).Status, 'PAID');
    assert.equal(await RefundRequests.count({ where: { OrderId: paid.order.OrderId }, transaction: tx }), 0);
    await signedPage.getByLabel('Lý do hoàn tiền *').selectOption('Người bán không giao hàng');
    await signedPage.getByLabel('Ngân hàng *').selectOption({ index: 1 });
    await signedPage.getByLabel('Số tài khoản *').fill('0001234567');
    await signedPage.getByLabel('Chủ tài khoản *').fill('D02 TEST');
    await signedPage.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
    await signedPage.waitForURL('**/refunds');
    const refund = await RefundRequests.findOne({ where: { OrderId: paid.order.OrderId }, transaction: tx });
    assert.equal(refund.Status, 'PENDING');
    assert.equal((await Orders.findByPk(paid.order.OrderId, { transaction: tx })).Status, 'REFUND_PENDING');
    async function refundAction(userId, data) {
      const response = await signedContext.request.patch(`${origin}/api/v1/refund-requests/${refund.RefundRequestId}`, { headers: { authorization: `Bearer ${token(userId)}` }, data });
      const body = await response.json(); assert.equal(response.status(), 200, JSON.stringify(body)); return body;
    }
    assert.equal((await refundAction(admin.UserId, { action: 'APPROVE' })).data.Status, 'APPROVED');
    assert.equal((await refundAction(seller.UserId, { action: 'SELLER_TRANSFERRED', transactionCode: 'D02-TEST-ROLLBACK' })).data.Status, 'SELLER_TRANSFERRED');
    assert.equal((await refundAction(demoId, { action: 'CONFIRM_RECEIVED' })).data.Status, 'COMPLETED');
    assert.equal((await Orders.findByPk(paid.order.OrderId, { transaction: tx })).Status, 'REFUNDED');
    console.log('PASS real JWT: D02 paid -> existing B06 form (opening is read-only) -> PENDING/REFUND_PENDING -> B07 approve/transfer/confirm -> REFUNDED.');

    const forbidden = await context.request.get(`${origin}/api/v1/orders/${reported.order.OrderId}/cancellation-preview`, { headers: { authorization: `Bearer ${token(seller.UserId)}` } });
    assert.equal(forbidden.status(), 403);
    assert.equal((await context.request.get(`${origin}/api/v1/admin/users`, { headers: { 'x-d01-demo': 'true' } })).status(), 401);
    const off = await browser.newPage();
    await off.goto(`http://127.0.0.1:4183/orders/${id}/cancel`); await off.waitForURL('**/login?returnTo=**');
    assert.equal(new URL(off.url()).searchParams.get('returnTo'), `/orders/${id}/cancel`);
    assert.deepEqual(errors, []);
    console.log('PASS production demo-off requires login; ownership/admin guards kept; no browser pageerror.');
  } finally {
    if (browser) await browser.close();
    for (const server of servers) if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    sequelize.transaction = original.transaction; d01.withTransaction = original.d01Transaction; d02.withTransaction = original.d02Transaction; d01.findListingPreview = original.preview;
    RefundRequests.findByPk = original.refundRead; RefundRequests.findAndCountAll = original.refundList;
    if (tx && !tx.finished && fixtureListingIds.length) fixtureOrderIds = (await Orders.findAll({ where: { ListingId: fixtureListingIds }, transaction: tx })).map(o => o.OrderId);
    if (tx && !tx.finished) await tx.rollback();
    try {
      if (fixtureListingIds.length) {
        assert.equal(await Listings.count({ where: { ListingId: fixtureListingIds } }), 0);
        assert.equal(await Orders.count({ where: { ListingId: fixtureListingIds } }), 0);
        if (fixtureOrderIds.length) {
          for (const model of [Payments, RefundRequests, StatusHistories]) assert.equal(await model.count({ where: { OrderId: fixtureOrderIds } }), 0);
          assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: fixtureOrderIds } }), 0);
        }
        console.log('PASS rollback: no persistent fixture listing/order/payment/refund/history/notification.');
      }
    } finally { await sequelize.close(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
