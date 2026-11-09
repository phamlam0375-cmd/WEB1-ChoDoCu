import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
if (process.env.D13_BROWSER_TEST !== 'true' || !process.env.D13_EXPECTED_MYSQL_UUID || !process.env.D13_PLAYWRIGHT_MODULE) throw new Error('Cần D13_BROWSER_TEST, UUID MySQL local và module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), backend = path.join(root, 'backend'), dist = path.join(root, 'frontend/dist')
const prefix = `d13_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
const { pngReceipt } = createRequire(import.meta.url)(path.join(backend, 'tests/D03_ThanhToan/fixtures'))
let child, server, browser, output = '', stage = 'khởi tạo'
try {
  child = spawn(process.execPath, ['scripts/serve-completion-test.js'], { cwd: backend, windowsHide: true, env: { ...process.env,
    NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu_d13_20261109', DB_LOGGING: 'false', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'false',
    D13_INTEGRATION_TEST: 'true', D13_BROWSER_PREFIX: prefix, D13_BROWSER_TEST_PASSWORD: password, D13_BROWSER_PORT: '0', D13_BROWSER_HOST: '127.0.0.1',
    JWT_SECRET: 'd13-browser-isolated-test-no-real-users', EMAIL_USER: '', EMAIL_PASS: '', MAIL_USER: '', MAIL_PASS: '', SMTP_USER: '', SMTP_PASS: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', bytes => { output += bytes.toString() }); child.stderr.on('data', () => {})
  let fixture
  for (let i = 0; i < 100; i++) {
    const match = output.match(/D13_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    if (child.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(fixture?.apiPort, 'D13 source fixture chưa sẵn sàng')
  server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request({ host: '127.0.0.1', port: fixture.apiPort, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      upstream.on('error', () => { res.writeHead(502); res.end() }); req.pipe(upstream); return
    }
    const target = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
    if (target !== dist && !target.startsWith(dist + path.sep)) { res.writeHead(400); res.end(); return }
    try { res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream'); res.end(await readFile(target)) }
    catch { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile(path.join(dist, 'index.html'))) }
  })
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`, { chromium } = await import(pathToFileURL(process.env.D13_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    await ctx.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
    return ctx
  }
  const buyerContext = await context(), buyer = await buyerContext.newPage(), seller = await (await context()).newPage(), driver = await (await context()).newPage(), pageErrors = []
  for (const page of [buyer, seller, driver]) { page.setDefaultTimeout(15000); page.on('pageerror', () => pageErrors.push(true)) }
  const login = async (page, label, destination) => {
    await page.goto(`${origin}/login?returnTo=${encodeURIComponent(destination)}`)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  stage = 'Home → JWT → D01 → C05 → D03 → D04'
  await buyer.goto(origin + '/')
  await buyer.locator('article').filter({ hasText: fixture.title }).getByRole('button', { name: 'Mua ngay', exact: true }).click()
  await buyer.waitForURL(/\/login\?returnTo=/)
  await buyer.locator('#login-email').fill(`${prefix}_buyer@example.test`); await buyer.locator('#login-password').fill(password); await buyer.locator('.login-submit').click()
  await buyer.waitForURL(`${origin}/orders/create/${fixture.listingId}`)
  await buyer.locator('#receiver-name').fill('Test Buyer'); await buyer.locator('#receiver-phone').fill('0900000111')
  await buyer.getByRole('radio', { name: /Giao hàng tận nơi/ }).check(); await buyer.locator('#receiver-address').fill('Địa chỉ giao fixture D13')
  await buyer.locator('#delivery-area').fill(fixture.area); await buyer.locator('#delivery-vehicle').selectOption('MOTORBIKE')
  await buyer.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click(); await buyer.getByRole('button', { name: 'Dùng mức phí này', exact: true }).click()
  const orderResponse = buyer.waitForResponse(r => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST')
  await buyer.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).click(); const ordered = await (await orderResponse).json(); assert.equal(ordered.success, true)
  const orderId = ordered.data.orderId
  await login(seller, 'seller', '/seller/orders')
  await seller.getByRole('row').filter({ hasText: `#${orderId}` }).getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  const accepted = seller.waitForResponse(r => r.url().endsWith(`/api/seller/store/order/${orderId}/status`) && r.request().method() === 'PATCH')
  await seller.getByRole('button', { name: 'Xác nhận', exact: true }).click(); assert.equal((await accepted).status(), 200)
  await buyer.goto(`${origin}/orders/${orderId}/payment`)
  await buyer.locator('#d03-proof').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() })
  await buyer.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click()
  await buyer.getByText('Đã gửi thông báo chuyển khoản cho người bán.', { exact: true }).first().waitFor()
  await seller.goto(`${origin}/seller/orders/${orderId}/payment`)
  await seller.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).click(); await seller.getByRole('button', { name: 'Lưu kết quả đối chiếu', exact: true }).click()
  await seller.getByText('Đã xác nhận nhận đủ tiền', { exact: true }).first().waitFor()
  stage = 'C07 → D07 → D08 → D09'
  await seller.goto(`${origin}/orders/${orderId}/tracking`)
  await seller.getByRole('checkbox', { name: 'Tôi đã chuẩn bị và đóng gói hàng để bàn giao.', exact: true }).check()
  const prepare = seller.waitForResponse(r => r.url().endsWith(`/api/seller/orders/${orderId}/preparation`) && r.request().method() === 'POST')
  await seller.getByRole('button', { name: 'Xác nhận sẵn sàng giao hàng', exact: true }).click(); const deliveryId = (await (await prepare).json()).data.DeliveryId
  await login(driver, 'browserdriver', '/driver/deliveries')
  await driver.getByRole('heading', { name: `Chuyến #${deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await seller.goto(`${origin}/seller/orders/${orderId}/pickup-code`)
  await seller.getByRole('checkbox').check()
  await seller.getByRole('button', { name: 'Xác nhận bàn giao và cấp mã', exact: true }).click()
  const pickupCode = (await seller.getByLabel('Mã lấy hàng', { exact: true }).textContent()).trim()
  assert.match(pickupCode, /^\d{6}$/)
  await driver.goto(`${origin}/driver/deliveries/${deliveryId}/pickup`)
  await driver.locator('#pickup-code').fill(pickupCode); await driver.getByRole('checkbox').check()
  await driver.locator('#pickup-proof').setInputFiles({ name: 'pickup.png', mimeType: 'image/png', buffer: pngReceipt() })
  await driver.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
  await driver.getByRole('link', { name: /Cập nhật tiến độ/ }).first().click()
  await driver.locator('#delivery-progress-status').selectOption('DELIVERING')
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).click()
  await driver.getByText('Đã cập nhật tiến độ giao hàng.', { exact: true }).waitFor()
  console.log('PASS D13 production UI: JWT → D01/D12 → C05/D03/D04/C07 → D07/D08/D09, không đường tắt nghiệp vụ')
  stage = 'D05 explicit buyer OTP, privacy/cooldown, wrong code/proof validation'
  let issues = 0
  buyerContext.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/delivery-code')) issues++ })
  await buyer.goto(`${origin}/orders/${orderId}/tracking`)
  const createCode = buyer.getByRole('button', { name: 'Tạo mã giao hàng', exact: true }); await createCode.waitFor()
  assert.equal(issues, 0)
  await createCode.click(); const code = (await buyer.getByLabel('Mã giao hàng', { exact: true }).textContent()).trim(); assert.match(code, /^\d{6}$/); assert.notEqual(code, pickupCode)
  assert.equal(await buyer.getByRole('button', { name: 'Tạo lại mã giao hàng', exact: true }).isDisabled(), true)
  assert.equal(await buyer.evaluate(value => JSON.stringify(localStorage).includes(value) || JSON.stringify(sessionStorage).includes(value), code), false)
  const refreshed = await buyerContext.newPage()
  await refreshed.goto(`${origin}/orders/${orderId}/tracking`)
  await refreshed.getByRole('button', { name: 'Tạo lại mã giao hàng', exact: true }).waitFor()
  assert.equal(await refreshed.getByLabel('Mã giao hàng', { exact: true }).count(), 0)
  assert.equal(issues, 1); await refreshed.close()
  await buyer.setViewportSize({ width: 390, height: 844 }); assert.equal(await buyer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await driver.getByRole('link', { name: 'Xác thực giao hàng bằng mã và ảnh bàn giao', exact: true }).click()
  await driver.waitForURL(`${origin}/driver/deliveries/${deliveryId}/complete`)
  assert.equal(await driver.getByRole('button', { name: /Tạo.*mã giao hàng/ }).count(), 0)
  await driver.locator('#completion-code').fill(code)
  await driver.getByRole('button', { name: 'Xác nhận giao hàng thành công', exact: true }).click()
  await driver.getByText('Vui lòng đính kèm ảnh bàn giao JPG hoặc PNG.', { exact: true }).waitFor()
  await driver.locator('#completion-proof').setInputFiles({ name: 'handover.png', mimeType: 'image/png', buffer: pngReceipt() })
  await driver.getByRole('img', { name: 'Ảnh bàn giao chuẩn bị gửi', exact: true }).waitFor()
  await driver.setViewportSize({ width: 390, height: 844 }); assert.equal(await driver.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await driver.getByRole('button', { name: 'Xác nhận giao hàng thành công', exact: true }).click()
  await driver.getByText('Vui lòng xác nhận đã bàn giao kiện hàng thực tế.', { exact: true }).waitFor()
  await driver.getByRole('checkbox').check(); await driver.locator('#completion-code').fill(pickupCode)
  await driver.getByRole('button', { name: 'Xác nhận giao hàng thành công', exact: true }).click()
  await driver.getByText('Mã xác thực không đúng hoặc đã hết hiệu lực.', { exact: true }).waitFor()
  await driver.locator('#completion-code').fill(code)
  stage = 'response lost → same-key retry → D05 verified → D06'
  let once = true, completionKey
  await driver.route(`**/api/v1/driver/deliveries/${deliveryId}/complete`, async route => {
    if (once) { once = false; completionKey = route.request().headers()['idempotency-key']; const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed') }
    else { assert.equal(route.request().headers()['idempotency-key'], completionKey); await route.continue() }
  })
  await driver.getByRole('button', { name: 'Xác nhận giao hàng thành công', exact: true }).evaluate(button => { button.click(); button.click() })
  await driver.getByRole('button', { name: 'Thử lại cùng yêu cầu', exact: true }).click()
  await driver.getByText('Đã xác thực giao hàng trước đó; không xử lý trùng.', { exact: true }).waitFor()
  await driver.getByRole('img', { name: `Bằng chứng giao hàng chuyến #${deliveryId}`, exact: true }).waitFor()
  await buyer.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await buyer.getByRole('link', { name: 'Xác nhận nhận hàng', exact: true }).first().waitFor()
  assert.equal(await buyer.getByLabel('Mã giao hàng', { exact: true }).count(), 0)
  await buyer.getByRole('img', { name: `Bằng chứng giao hàng chuyến #${deliveryId}`, exact: true }).waitFor()
  await buyer.getByRole('img', { name: `Bằng chứng lấy hàng chuyến #${deliveryId}`, exact: true }).waitFor()
  await buyer.getByRole('link', { name: 'Xác nhận nhận hàng', exact: true }).first().click()
  await buyer.getByRole('checkbox', { name: 'Tôi đã nhận được sản phẩm', exact: true }).check()
  await buyer.getByRole('button', { name: 'Xác nhận hoàn tất', exact: true }).click()
  await buyer.getByText(/Đã xác nhận nhận hàng/).first().waitFor()
  await driver.reload(); await driver.getByText('Chuyến: DELIVERED · Đơn: COMPLETED', { exact: true }).waitFor()
  assert.equal(await driver.locator('#completion-code').count(), 0)
  assert.equal(issues, 1); assert.equal(pageErrors.length, 0)
  console.log(`PASS D13 production UI ${origin}: buyer/driver tách phiên, explicit OTP/cooldown, thiếu proof/checkbox, D08 code sai, lost response retry một key, D05 ảnh private → D06 COMPLETED, refresh đúng trạng thái, không JS error.`)
} catch (error) { console.error(`D13 production UI failed (${stage}):`, error.name, error.message); process.exitCode = 1 }
finally { if (browser) await browser.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } if (child) child.kill() }
