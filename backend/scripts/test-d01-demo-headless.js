'use strict';

// Chạy sau verify-d01-demo-build.js trên cổng riêng, không dùng CD/live Chrome.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.D01_PLAYWRIGHT_PATH || 'playwright');

async function main() {
  const target = new URL(process.env.D01_VERIFY_URL);
  assert.equal(target.hostname, '127.0.0.1', 'Chỉ chạy trên fixture localhost.');
  assert.equal(target.port, '4180');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext(); // Không dùng profile/cookie tài khoản thật.
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const previewResponse = page.waitForResponse(response => response.url().includes('/api/v1/orders/preview/'));
    await page.goto(target.href);
    const preview = await previewResponse;
    assert.equal(preview.status(), 200);
    const headers = await preview.request().allHeaders();
    assert.equal(headers['x-d01-demo'], 'true');
    assert.equal(headers.authorization, undefined);
    assert.equal(headers['x-user-id'], undefined);
    await page.getByRole('heading', { name: 'Đặt hàng và giữ món', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, target.pathname);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.ok(await page.getByText('Chế độ test D01:', { exact: false }).isVisible());
    console.log('PASS: production bundle anonymous -> D01 preview 200; no login/token/devUserId; marker only.');

    const admin = await context.request.get(`${target.origin}/api/v1/admin/users`, { headers: { 'x-d01-demo': 'true' } });
    const me = await context.request.get(`${target.origin}/api/v1/me`, { headers: { 'x-d01-demo': 'true' } });
    assert.equal(admin.status(), 401);
    assert.equal(me.status(), 401);
    await page.getByLabel('Họ và tên người nhận', { exact: false }).fill('D01 Production Test');
    await page.getByLabel('Số điện thoại', { exact: false }).fill('0901234567');
    const createdResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).click();
    const created = await createdResponse;
    assert.equal(created.status(), 201);
    const result = await created.json();
    assert.equal(result.data.status, 'RESERVED');
    assert.equal(result.data.totalAmount, 123456);
    await page.getByRole('heading', { name: 'Sản phẩm đã được giữ cho bạn' }).waitFor();
    assert.ok(await page.getByText('ĐANG GIỮ MÓN', { exact: true }).isVisible());
    assert.deepEqual(errors, []);
    if (process.env.D01_SCREENSHOT_PATH) await page.screenshot({ path: process.env.D01_SCREENSHOT_PATH, fullPage: true });
    console.log(JSON.stringify({ ok: true, production: true, anonymous: true, createStatus: 201, orderStatus: result.data.status, orderId: result.data.orderId, totalAmount: result.data.totalAmount, reservedUntil: result.data.reservedUntil, adminStatus: admin.status(), meStatus: me.status(), pageErrors: errors }));

    await page.goto(target.origin);
    await page.getByRole('button', { name: 'Mua ngay', exact: true }).first().click();
    await page.waitForURL('**/orders/create/*');
    assert.match(new URL(page.url()).pathname, /^\/orders\/create\/[1-9]\d*$/);
    console.log('PASS: homepage buy -> valid D01 route without login in production demo.');

    const offContext = await browser.newContext();
    const offPage = await offContext.newPage();
    await offPage.goto('http://127.0.0.1:4181/orders/create/1');
    await offPage.waitForURL('**/login?returnTo=*');
    assert.equal(new URL(offPage.url()).pathname, '/login');
    assert.equal(new URL(offPage.url()).searchParams.get('returnTo'), '/orders/create/1');
    console.log('PASS: production bundle demo OFF -> login with returnTo preserved.');
    await context.close();
    await offContext.close();
  } finally {
    await browser.close();
    if (process.env.D01_VERIFY_STOP === 'true') {
      const stopped = await fetch(`${target.origin}/__d01_verify__/stop`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      assert.equal(stopped.status, 202, 'Server fixture phải xác nhận yêu cầu cleanup.');
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
