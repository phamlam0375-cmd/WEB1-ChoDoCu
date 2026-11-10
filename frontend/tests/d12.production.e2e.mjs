import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
if (process.env.D12_BROWSER_TEST !== 'true' || !process.env.D12_EXPECTED_MYSQL_UUID || !process.env.D12_PLAYWRIGHT_MODULE) throw new Error('Cần D12_BROWSER_TEST, UUID MySQL local và module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), backend = path.join(root, 'backend'), dist = path.join(root, 'frontend/dist')
const prefix = `d12_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
const { pngReceipt } = createRequire(import.meta.url)(path.join(backend, 'tests/D03_ThanhToan/fixtures'))
let child, server, browser, output = '', stage = 'khởi tạo'
try {
  child = spawn(process.execPath, ['scripts/serve-fee-test.js'], { cwd: backend, windowsHide: true, env: { ...process.env,
    NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu_d12_20261106', DB_LOGGING: 'false', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'false',
    D12_INTEGRATION_TEST: 'true', D12_BROWSER_PREFIX: prefix, D12_BROWSER_TEST_PASSWORD: password, D12_BROWSER_PORT: '0', D12_BROWSER_HOST: '127.0.0.1',
    JWT_SECRET: 'd12-browser-isolated-test-no-real-users', EMAIL_USER: '', EMAIL_PASS: '', MAIL_USER: '', MAIL_PASS: '', SMTP_USER: '', SMTP_PASS: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', bytes => { output += bytes.toString() }); child.stderr.on('data', () => {})
  let fixture
  for (let i = 0; i < 100; i++) {
    const match = output.match(/D12_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    if (child.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(fixture?.apiPort, 'D12 source fixture chưa sẵn sàng')
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
  const origin = `http://127.0.0.1:${server.address().port}`, { chromium } = await import(pathToFileURL(process.env.D12_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Asia/Ho_Chi_Minh' })
    await ctx.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
    return ctx
  }
  const buyerContext = await context(), buyer = await buyerContext.newPage(), seller = await (await context()).newPage(), driver = await (await context()).newPage(), pageErrors = []
  for (const p of [buyer, seller, driver]) { p.setDefaultTimeout(12000); p.on('pageerror', () => pageErrors.push(true)) }
  const login = async (page, label, destination) => {
    await page.goto(`${origin}/login?returnTo=${encodeURIComponent(destination)}`)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  stage = 'C02 chủ cửa hàng lưu khu vực qua UI'
  await login(seller, 'seller', '/seller/store')
  await seller.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click()
  await seller.waitForFunction(expected => document.querySelector('#store-pickup-area')?.value === expected, fixture.area)
  await seller.locator('#store-pickup-area').fill(fixture.area.toLowerCase())
  const savedStore = seller.waitForResponse(r => r.url().endsWith(`/api/stores/${fixture.sellerId}`) && r.request().method() === 'PATCH')
  await seller.getByRole('button', { name: 'Lưu thông tin', exact: true }).click()
  const savedStoreResponse = await savedStore; assert.equal(savedStoreResponse.status(), 200); assert.equal((await savedStoreResponse.json()).data.PickupArea, fixture.area.toLowerCase())
  await seller.reload(); await seller.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click()
  await seller.waitForFunction(expected => document.querySelector('#store-pickup-area')?.value === expected, fixture.area.toLowerCase())
  assert.equal(await seller.locator('#store-pickup-area').inputValue(), fixture.area.toLowerCase())
  console.log('PASS D12 UI: C02 đúng chủ lưu khu vực lấy riêng và refresh giữ dữ liệu')
  stage = 'trang chủ mua -> đăng nhập -> D01'
  await buyer.goto(origin + '/')
  await buyer.locator('article').filter({ hasText: fixture.title }).getByRole('button', { name: 'Mua ngay', exact: true }).click()
  await buyer.waitForURL(/\/login\?returnTo=/)
  assert.equal(new URL(buyer.url()).searchParams.get('returnTo'), `/orders/create/${fixture.listingId}`)
  await buyer.locator('#login-email').fill(`${prefix}_buyer@example.test`); await buyer.locator('#login-password').fill(password); await buyer.locator('.login-submit').click()
  await buyer.waitForURL(`${origin}/orders/create/${fixture.listingId}`)
  await buyer.locator('#receiver-name').fill('Test Buyer'); await buyer.locator('#receiver-phone').fill('0900000111')
  await buyer.getByRole('radio', { name: /Giao hàng tận nơi/ }).check()
  await buyer.locator('#receiver-address').fill('Nhà số 1, địa chỉ nhận fixture')
  await buyer.locator('#delivery-area').fill('NO_ROUTE'); await buyer.locator('#delivery-vehicle').selectOption('MOTORBIKE')
  await buyer.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click()
  await buyer.getByText('Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.', { exact: true }).first().waitFor()
  assert.equal(await buyer.getByTestId('order-delivery-fee').textContent(), 'Chưa có báo giá')
  assert.equal(await buyer.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).isDisabled(), true)
  console.log('PASS D12 UI: Home Mua ngay -> JWT -> D01; tuyến không hỗ trợ không hiện phí 0 hoặc tự đổi PICKUP')
  stage = 'response cũ không ghi đè lựa chọn mới'
  let release, started
  const gate = new Promise(resolve => { release = resolve }), firstStarted = new Promise(resolve => { started = resolve })
  let first = true
  await buyer.route('**/api/v1/delivery-fees/estimate', async route => {
    if (first) { first = false; const response = await route.fetch(); started(); await gate; try { await route.fulfill({ response }) } catch { /* request cũ đã hủy */ } }
    else await route.continue()
  })
  await buyer.locator('#delivery-area').fill(fixture.area); await buyer.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click(); await firstStarted
  await buyer.locator('#delivery-area').fill(fixture.otherArea); await buyer.locator('#delivery-vehicle').selectOption('TRUCK')
  await buyer.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click(); await buyer.getByTestId('quoted-fee').getByText('30.000,30 ₫', { exact: true }).waitFor()
  release(); await buyer.unroute('**/api/v1/delivery-fees/estimate')
  assert.equal(await buyer.getByTestId('quoted-fee').textContent(), '30.000,30 ₫')
  await buyer.getByText('Thời gian tham khảo: 40 phút, không phải cam kết thời điểm giao.', { exact: true }).waitFor()
  stage = 'xác nhận mức phí và lưu đơn'
  await buyer.locator('#delivery-area').fill(fixture.area); await buyer.locator('#delivery-vehicle').selectOption('MOTORBIKE')
  await buyer.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click(); await buyer.getByTestId('quoted-fee').getByText('20.000,20 ₫', { exact: true }).waitFor()
  assert.equal(await buyer.getByText(/Thời gian tham khảo:/).count(), 0)
  assert.equal(await buyer.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).isDisabled(), true)
  await buyer.getByRole('button', { name: 'Dùng mức phí này', exact: true }).click()
  await buyer.getByRole('alert').filter({ hasText: 'Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.' }).waitFor({ state: 'hidden' })
  assert.equal(await buyer.getByTestId('order-total').textContent(), '120.000,30 ₫')
  await mkdir(path.join(root, 'frontend/test-results'), { recursive: true })
  await buyer.screenshot({ path: path.join(root, 'frontend/test-results/d12-quote-production.png'), fullPage: true })
  await buyer.setViewportSize({ width: 390, height: 844 })
  assert.equal(await buyer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'D12 không tràn ngang viewport trên mobile')
  await buyer.screenshot({ path: path.join(root, 'frontend/test-results/d12-quote-mobile.png'), fullPage: true })
  await buyer.setViewportSize({ width: 1440, height: 1100 })
  let creates = 0
  buyer.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/api/v1/orders')) creates++ })
  const orderResponse = buyer.waitForResponse(r => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST')
  await buyer.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).evaluate(button => { button.click(); button.click() })
  const ordered = await (await orderResponse).json(); assert.equal(ordered.success, true); assert.equal(creates, 1)
  const orderId = ordered.data.orderId; assert.equal(ordered.data.deliveryFee, 20000.2)
  await buyer.getByRole('heading', { name: 'Sản phẩm đã được giữ cho bạn', exact: true }).waitFor()
  console.log('PASS D12 UI: response chậm bị loại, NULL phút không hiện 0, phải chọn mức phí; tạo đơn một lần đúng tổng tiền lẻ')
  stage = 'C05 -> D03 -> D04 -> C07 -> D07 qua UI'
  await seller.goto(origin + '/seller/orders')
  await seller.getByRole('row').filter({ hasText: `#${orderId}` }).getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  const accepted = seller.waitForResponse(r => r.url().endsWith(`/api/seller/store/order/${orderId}/status`) && r.request().method() === 'PATCH')
  await seller.getByRole('button', { name: 'Xác nhận', exact: true }).click(); assert.equal((await accepted).status(), 200)
  await buyer.getByRole('button', { name: 'Thanh toán', exact: true }).click(); await buyer.waitForURL(`${origin}/orders/${orderId}/payment`)
  await buyer.getByRole('heading', { name: 'Thanh toán cho người bán', exact: true }).waitFor()
  const paymentInfo = await buyerContext.request.get(`${origin}/api/v1/orders/${orderId}/payment-info`, { headers: { Authorization: `Bearer ${await buyer.evaluate(() => localStorage.getItem('accessToken'))}` } })
  const payment = (await paymentInfo.json()).data; assert.equal(payment.productAmount, '100000.10'); assert.equal(payment.sellerAmount, '100000.10'); assert.equal(payment.deliveryFee, '20000.20')
  await buyer.locator('#d03-proof').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: pngReceipt() })
  await buyer.getByRole('button', { name: 'Tôi đã chuyển tiền', exact: true }).click()
  await buyer.getByText('Đã gửi thông báo chuyển khoản cho người bán.', { exact: true }).first().waitFor()
  await seller.goto(`${origin}/seller/orders/${orderId}/payment`)
  await seller.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).click()
  await seller.getByRole('button', { name: 'Lưu kết quả đối chiếu', exact: true }).click()
  await seller.getByText('Đã xác nhận nhận đủ tiền', { exact: true }).first().waitFor()
  await seller.goto(`${origin}/orders/${orderId}/tracking`)
  await seller.getByRole('checkbox', { name: 'Tôi đã chuẩn bị và đóng gói hàng để bàn giao.', exact: true }).check()
  const preparedResponse = seller.waitForResponse(r => r.url().endsWith(`/api/seller/orders/${orderId}/preparation`) && r.request().method() === 'POST')
  await seller.getByRole('button', { name: 'Xác nhận sẵn sàng giao hàng', exact: true }).click()
  const prepared = await (await preparedResponse).json(); assert.equal(prepared.success, true)
  const deliveryId = prepared.data.DeliveryId
  await login(driver, 'browserdriver', '/driver/deliveries')
  await driver.getByRole('heading', { name: `Chuyến #${deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await buyer.goto(`${origin}/orders/${orderId}/tracking`)
  for (const [label, amount] of [['Tiền sản phẩm (trả người bán)', '100.000,10 ₫'], ['Phí giao hàng (trả tài xế)', '20.000,20 ₫'], ['Tổng chi phí', '120.000,30 ₫']]) assert.equal((await buyer.locator('dt').filter({ hasText: label }).locator('..').locator('dd').textContent()).trim(), amount)
  console.log('PASS D12 UI: C05 chấp nhận -> D03 chỉ tiền sản phẩm -> D04 đối chiếu -> C07 chuẩn bị -> D07 nhận chuyến -> D05 tách ba khoản')
  stage = 'hết hạn giữ thông tin, refresh yêu cầu tính lại, đổi DELIVERY/PICKUP'
  const extra = await buyerContext.newPage(); extra.setDefaultTimeout(12000); extra.on('pageerror', () => pageErrors.push(true))
  await extra.goto(`${origin}/orders/create/${fixture.expireListingId}`)
  await extra.locator('#receiver-name').fill('Test Buyer'); await extra.locator('#receiver-phone').fill('0900000111')
  await extra.getByRole('radio', { name: /Giao hàng tận nơi/ }).check(); await extra.locator('#receiver-address').fill('Địa chỉ giữ sau hết hạn')
  await extra.locator('#delivery-area').fill(fixture.area); await extra.locator('#delivery-vehicle').selectOption('MOTORBIKE')
  await extra.clock.install(); await extra.getByRole('button', { name: 'Tính phí giao hàng', exact: true }).click(); await extra.getByRole('button', { name: 'Dùng mức phí này', exact: true }).click()
  await extra.clock.fastForward(301000)
  await extra.getByText('Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.', { exact: true }).waitFor()
  assert.equal(await extra.locator('#receiver-address').inputValue(), 'Địa chỉ giữ sau hết hạn'); assert.equal(await extra.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).isDisabled(), true)
  await extra.reload(); await extra.getByRole('radio', { name: /Giao hàng tận nơi/ }).check()
  assert.equal(await extra.getByTestId('order-delivery-fee').textContent(), 'Chưa có báo giá')
  await extra.getByRole('radio', { name: /Tự đến lấy hàng/ }).check(); assert.equal(await extra.getByTestId('order-delivery-fee').textContent(), '0 ₫')
  await extra.locator('#receiver-name').fill('Test Buyer'); await extra.locator('#receiver-phone').fill('0900000111')
  const pickupResponse = extra.waitForResponse(r => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST')
  await extra.getByRole('button', { name: 'Đặt hàng và giữ món', exact: true }).click()
  const pickup = await (await pickupResponse).json(); assert.equal(pickup.data.deliveryFee, 0); assert.equal(pickup.data.totalAmount, 100000.1); assert.equal(pickup.data.deliveryMethod, 'PICKUP')
  assert.equal(pageErrors.length, 0)
  console.log(`PASS D12 UI: production ${origin}; virtual-clock expiry giữ form, refresh bỏ quote, PICKUP phí0, không lỗi JS. Source API và DB D12 test riêng.`)
} catch (error) { console.error(`D12 production UI failed (${stage}):`, error.name, error.message); process.exitCode = 1 }
finally { if (browser) await browser.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } if (child) child.kill() }
