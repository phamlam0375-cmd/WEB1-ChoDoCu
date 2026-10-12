'use strict';

// Smoke thực tế Docker/nginx và Vite dev, chỉ trên MySQL fixture riêng.
if (process.env.D03_ISOLATED_TEST !== 'true') throw new Error('Cần D03_ISOLATED_TEST=true, MySQL fixture 33306 và Docker test 8183.');
Object.assign(process.env, { NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: '33306', DB_NAME: 'cho_do_cu_d03_fixture', DB_USER: 'root', DB_PASSWORD: 'd03-isolated-fixture-only' });
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.D01_PLAYWRIGHT_PATH || 'playwright');
const { sequelize, Users, Categories, Listings, Orders, Payments, StatusHistories, Notifications } = require('../../src/models');
const d01 = require('../../src/services/order.service');
const { pngReceipt } = require('./fixtures');

async function main() {
  let browser, vite;
  try {
    assert.equal(sequelize.config.database, 'cho_do_cu_d03_fixture'); assert.equal(Number(sequelize.config.port), 33306);
    const buyer = await Users.findOne({ where: { Username: 'D03_buyer' } }), seller = await Users.findOne({ where: { Username: 'D03_seller' } });
    assert.ok(buyer && seller); assert.equal(buyer.UserId, 1);
    const category = await Categories.findOne({ where: { CategoryName: 'D03 isolated fixtures' } }); assert.ok(category);
    const frontend = path.resolve(__dirname, '../../../frontend');
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5193', '--strictPort'], {
      cwd: frontend, windowsHide: true, env: { ...process.env, NODE_ENV: 'development', VITE_API_PROXY_TARGET: 'http://127.0.0.1:8183', VITE_D01_DEMO_MODE: 'true' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite chưa sẵn sàng')), 20000);
      vite.once('error', reject); vite.once('exit', code => reject(new Error(`Vite exit ${code}`)));
      vite.stdout.on('data', chunk => { if (String(chunk).includes('5193')) { clearTimeout(timeout); resolve(); } });
      vite.stderr.on('data', chunk => console.error(String(chunk)));
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.D01_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    for (const [label, origin] of [['Docker production', 'http://127.0.0.1:8183'], ['Vite local', 'http://127.0.0.1:5193']]) {
      const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: `D03 ${label} fixture`, Description: 'Isolated', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
      const created = await d01.createOrder({ listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Fixture', receiverPhone: '0901234567' }, buyer.UserId);
      const id = created.data.orderId; await Orders.update({ Status: 'WAITING_PAYMENT' }, { where: { OrderId: id } });
      const context = await browser.newContext({ viewport: label.startsWith('Docker') ? { width: 1280, height: 950 } : { width: 390, height: 844 } });
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/orders/${id}/payment`);
      await page.getByText('Mã QR của người bán sẽ được cập nhật sau.', { exact: true }).waitFor();
      await page.getByLabel('Biên lai chuyển khoản *', { exact: true }).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() });
      await page.getByAltText('Xem trước biên lai').waitFor();
      const screenshot = path.join(os.tmpdir(), `WEB1-D03-${label.startsWith('Docker') ? 'desktop' : 'mobile'}.png`);
      await page.screenshot({ path: screenshot, fullPage: true }); console.log(`SCREENSHOT ${screenshot}`);
      const response = page.waitForResponse(res => res.url().endsWith('/payment-notice') && res.request().method() === 'POST');
      await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click();
      const sent = await response; assert.equal(sent.status(), 200); const result = await sent.json();
      assert.equal(result.data.paymentStatus, 'REPORTED'); assert.equal(result.data.status, 'WAITING_PAYMENT');
      assert.equal(result.data.qr.imageUrl, null); assert.equal(result.data.bank.accountNumber, '0001234567');
      const proof = await context.request.get(`${origin}${result.data.proofUrl}`); assert.equal(proof.status(), 200);
      assert.deepEqual(await proof.body(), pngReceipt());
      assert.equal((await Payments.findOne({ where: { OrderId: id } })).Amount, '123456.10');
      assert.equal(await StatusHistories.count({ where: { OrderId: id, StatusType: 'PAYMENT', StatusValue: 'REPORTED' } }), 1);
      assert.equal(await Notifications.count({ where: { ReferenceId: id, ReferenceType: 'ORDER', Type: 'PAYMENT' } }), 1);
      await page.reload(); await page.getByText('Đã báo chuyển tiền — chờ người bán xác nhận', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).isDisabled(), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${label}: chưa đăng nhập mở D03, QR null, upload/proxy 200, REPORTED chưa PAID, proof đọc 200, reload đúng DB, no pageerror.`);
      if (label === 'Docker production') {
        const lostListing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: 'D03 lost response fixture', Description: 'Isolated', Price: '123456.10', ConditionLevel: 'GOOD', Status: 'ACTIVE' });
        const lostOrder = await d01.createOrder({ listingId: lostListing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Fixture', receiverPhone: '0901234567' }, buyer.UserId);
        const lostId = lostOrder.data.orderId; await Orders.update({ Status: 'WAITING_PAYMENT' }, { where: { OrderId: lostId } });
        await page.goto(`${origin}/orders/${lostId}/payment`);
        await page.getByLabel('Biên lai chuyển khoản *', { exact: true }).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() });
        // Backend đã commit nhưng client mất response: trang phải đọc lại REPORTED,
        // không tự gửi lần hai hoặc coi như chưa có giao dịch.
        await page.route('**/payment-notice', async route => {
          const forwarded = await route.fetch(); assert.equal(forwarded.status(), 200); await route.abort('failed');
        });
        await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click();
        await page.getByText('Đã báo chuyển tiền — chờ người bán xác nhận', { exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).isDisabled(), true);
        assert.equal(await StatusHistories.count({ where: { OrderId: lostId, StatusType: 'PAYMENT', StatusValue: 'REPORTED' } }), 1);
        await page.reload(); await page.getByText('Đã báo chuyển tiền — chờ người bán xác nhận', { exact: true }).first().waitFor();
        console.log('PASS Docker mất response sau commit: GET/reload thấy REPORTED, không báo lại/trùng history.');
      }
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (vite && vite.exitCode === null) {
      const exited = new Promise(resolve => vite.once('exit', resolve)); vite.kill(); await exited;
    }
    await sequelize.close();
    console.log('CLEANUP: Vite/headless riêng đã dừng; proof chỉ trong container API test, SQL chỉ trong MySQL fixture.');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
