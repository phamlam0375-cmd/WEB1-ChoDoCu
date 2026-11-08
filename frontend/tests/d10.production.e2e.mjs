import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.D10_BROWSER_TEST !== 'true' || !process.env.D10_EXPECTED_MYSQL_UUID || !process.env.D10_PLAYWRIGHT_MODULE) throw new Error('Cần bật D10_BROWSER_TEST, UUID MySQL local và module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), frontend = path.join(root, 'frontend'), backend = path.join(root, 'backend'), dist = path.join(frontend, 'dist')
const prefix = `d10_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
let child, server, browser, stage = 'khởi tạo', childOutput = ''
try {
  // Chạy chính source local với test DB đã guard UUID, không dùng API/CD có sẵn.
  child = spawn(process.execPath, ['scripts/serve-pickup-test.js'], { cwd: backend, windowsHide: true, env: { ...process.env,
    NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu_d10_20261106', DB_LOGGING: 'false',
    D10_INTEGRATION_TEST: 'true', D10_BROWSER_PREFIX: prefix, D10_BROWSER_TEST_PASSWORD: password, D10_BROWSER_RECEIVE: 'true', D10_BROWSER_PORT: '0', D10_BROWSER_HOST: '127.0.0.1',
    JWT_SECRET: 'd10-browser-test-only-no-real-users', EMAIL_USER: '', EMAIL_PASS: '', MAIL_USER: '', MAIL_PASS: '', SMTP_USER: '', SMTP_PASS: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', data => { childOutput += data.toString() }); child.stderr.on('data', () => {})
  let fixture
  for (let attempt = 0; attempt < 100; attempt++) {
    const match = childOutput.match(/D08_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    if (child.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(fixture?.apiPort, 'Fixture test chưa sẵn sàng')
  server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request({ host: '127.0.0.1', port: fixture.apiPort, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      upstream.on('error', () => { res.writeHead(502); res.end() }); req.pipe(upstream); return
    }
    const target = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
    if (target !== dist && !target.startsWith(dist + path.sep)) { res.writeHead(400); res.end(); return }
    try { const bytes = await readFile(target); res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream'); res.end(bytes) }
    catch { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile(path.join(dist, 'index.html'))) }
  })
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const { chromium } = await import(pathToFileURL(process.env.D10_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Asia/Ho_Chi_Minh' })
    await c.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
    return c
  }
  const driver = await (await context()).newPage(), seller = await (await context()).newPage(), buyer = await (await context()).newPage(), pageErrors = []
  for (const p of [driver, seller, buyer]) p.on('pageerror', () => pageErrors.push(true))
  const login = async (page, label, destination) => {
    await page.goto(origin + destination); await page.waitForURL(/\/login\?returnTo=/)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), destination)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  stage = 'D07-D08-D09 qua UI'
  await login(driver, 'browserdriver', '/driver/deliveries')
  await driver.getByRole('heading', { name: `Chuyến #${fixture.deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await driver.getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await driver.getByRole('link', { name: 'Xác nhận đã lấy hàng', exact: true }).first().click()
  await login(seller, 'seller', `/seller/orders/${fixture.orderId}/pickup-code`)
  await seller.getByRole('checkbox').check(); await seller.getByRole('button', { name: 'Xác nhận bàn giao và cấp mã', exact: true }).click()
  const output = seller.locator('output[aria-label="Mã lấy hàng"]'); await output.waitFor()
  const code = (await output.textContent()).trim(); assert.ok(/^\d{6}$/.test(code), 'Định dạng mã hợp lệ')
  await driver.getByRole('button', { name: 'Tải lại', exact: true }).click(); await driver.getByText('Mã có hiệu lực đến', { exact: false }).waitFor()
  await driver.locator('#pickup-code').fill(code); await driver.getByRole('checkbox').check(); await driver.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
  await driver.getByText('Đã nhận kiện; chuyến chuyển sang PICKED_UP.', { exact: true }).waitFor()
  await driver.getByRole('link', { name: 'Cập nhật tiến độ giao hàng', exact: true }).click()
  await driver.locator('#delivery-progress-status').selectOption('DELIVERING'); await driver.locator('#delivery-progress-note').fill('Bắt đầu giao qua UI D09')
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).click(); await driver.getByText('Đã cập nhật tiến độ giao hàng.', { exact: true }).waitFor()
  await driver.getByRole('link', { name: 'Giao không thành công / Chuyển hoàn', exact: true }).click()
  await driver.getByRole('button', { name: 'Ghi nhận giao thất bại', exact: true }).waitFor()
  console.log('PASS D10 UI: đăng nhập thật → nhận chuyến D07 → bàn giao/D08 → D09 → mở D10')
  const requests = [], returns = []
  let lastPreview, loseFirst = true
  driver.on('request', req => {
    if (req.method() !== 'PATCH') return
    if (req.url().endsWith('/failure')) requests.push({ body: JSON.parse(req.postData()), key: req.headers()['idempotency-key'], version: req.headers()['if-match'] })
    if (req.url().endsWith('/return')) returns.push(JSON.parse(req.postData()))
  })
  driver.on('response', async response => { if (response.url().endsWith('/failure-preview') && response.status() === 200) { try { lastPreview = (await response.json()).data } catch { /* page navigation */ } } })
  stage = 'FAIL mất phản hồi/retry'
  await driver.getByRole('button', { name: 'Ghi nhận giao thất bại', exact: true }).click()
  await driver.getByText('Vui lòng chọn lý do giao không thành công.', { exact: true }).waitFor(); assert.equal(requests.length, 0)
  await driver.locator('#failure-reason').selectOption('OTHER'); await driver.locator('#failure-note').fill('Khách hẹn lại, chưa nhận kiện')
  await driver.route('**/api/v1/driver/deliveries/*/failure', async route => {
    if (loseFirst) { loseFirst = false; const result = await route.fetch(); assert.equal(result.status(), 200); await route.abort('failed') }
    else await route.continue()
  })
  await driver.getByRole('button', { name: 'Ghi nhận giao thất bại', exact: true }).evaluate(element => { element.click(); element.click() })
  await driver.getByRole('button', { name: 'Thử lại đúng thao tác đang chờ', exact: true }).waitFor()
  assert.equal(await driver.locator('#failure-note').inputValue(), 'Khách hẹn lại, chưa nhận kiện')
  await driver.getByRole('button', { name: 'Thử lại đúng thao tác đang chờ', exact: true }).click()
  await driver.getByText('Thao tác D10 đã được ghi nhận; không xử lý trùng.', { exact: true }).waitFor()
  assert.equal(requests.length, 2); assert.equal(requests[0].key, requests[1].key); assert.equal(requests[0].version, requests[1].version)
  console.log('PASS D10 UI: lỗi mạng sau commit giữ nội dung; retry cùng khóa/version, không ghi thất bại hai lần')
  stage = 'hẹn giao lại và refresh'
  const localTime = await driver.evaluate(() => { const d = new Date(Date.now() + 2200), pad = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` })
  await driver.locator('#retry-schedule').fill(localTime); await driver.getByRole('button', { name: 'Hẹn giao lại', exact: true }).click()
  await driver.getByText('Đã lưu lịch giao lại. Chưa bắt đầu giao và chưa tăng số lần giao lại.', { exact: true }).waitFor()
  assert.ok(requests.at(-1).body.scheduledAt.endsWith('Z')); assert.equal(await driver.getByRole('button', { name: 'Bắt đầu giao lại', exact: true }).isDisabled(), true)
  await driver.reload(); await driver.getByText('Lịch giao lại đã lưu:', { exact: false }).waitFor()
  assert.equal(lastPreview.retryCount, 0); assert.equal(lastPreview.failureCount, 1); assert.equal(lastPreview.deliveryStatus, 'FAILED')
  const calls = requests.length
  await new Promise(resolve => setTimeout(resolve, Math.max(0, new Date(lastPreview.scheduledAt).getTime() - Date.now() + 100)))
  assert.equal(requests.length, calls, 'Tới giờ không tự POST giao lại')
  await driver.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await driver.getByRole('button', { name: 'Bắt đầu giao lại', exact: true }).click()
  await driver.getByText('Đã bắt đầu lần giao lại; tài xế tiếp tục phụ trách và giữ trạng thái vận hành.', { exact: true }).waitFor()
  await driver.locator('#failure-reason').selectOption('UNAVAILABLE'); await driver.locator('#failure-note').fill('<b>Người nhận vẫn vắng</b>')
  await driver.getByRole('button', { name: 'Ghi nhận giao thất bại', exact: true }).click()
  await driver.getByText('Đã ghi nhận lần giao thất bại thứ 2.', { exact: true }).waitFor()
  console.log('PASS D10 UI nhánh A: lịch +07 chuyển UTC, refresh giữ lịch, chủ động giao lại rồi ghi thất bại lần mới')
  stage = 'RETURNING, hủy dialog không ghi'
  await driver.getByRole('button', { name: 'Chuyển hoàn', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click(); assert.equal(returns.length, 0)
  await driver.getByRole('button', { name: 'Chuyển hoàn', exact: true }).click()
  await driver.getByRole('button', { name: 'Xác nhận chuyển hoàn', exact: true }).click()
  await driver.getByText('Đã chuyển sang RETURNING và thông báo cho các bên.', { exact: true }).waitFor()
  await driver.locator('#return-recipient').waitFor(); assert.equal(returns.length, 1)
  stage = 'B06 buyer thật, form được điền sẵn'
  await login(buyer, 'buyer', `/orders/${fixture.orderId}/tracking`)
  stage = 'buyer mở link B06 từ D05'
  await buyer.getByRole('link', { name: 'Tiếp tục yêu cầu hoàn tiền B06', exact: true }).click()
  stage = 'B06 tải lý do và thông tin gợi ý'
  const form = buyer.locator('form').filter({ has: buyer.getByRole('button', { name: 'Gửi yêu cầu', exact: true }) })
  await form.locator('select').first().locator('option').filter({ hasText: 'Không nhận được hàng' }).waitFor({ state: 'attached' })
  assert.equal(await form.locator('select').first().inputValue(), 'Không nhận được hàng')
  await buyer.waitForFunction(() => [...document.querySelectorAll('textarea')].some(e => e.value.includes('Trả kiện không đồng nghĩa đã hoàn tiền.')))
  stage = 'B06 chọn tài khoản nhận tiền'
  await form.locator('fieldset select').selectOption('970418'); await form.locator('fieldset input').nth(0).fill('1234567890'); await form.locator('fieldset input').nth(1).fill('TEST BUYER')
  stage = 'B06 gửi yêu cầu bởi buyer'
  await form.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click(); await buyer.waitForURL(origin + '/refunds')
  stage = 'REFUND_PENDING không chặn RETURNED'
  await driver.reload(); await driver.locator('#return-recipient').waitFor()
  await driver.locator('#return-recipient').fill('Người bán fixture'); await driver.locator('#return-confirmed').check()
  let loseReturn = true
  await driver.route('**/api/v1/driver/deliveries/*/return', async route => {
    if (loseReturn && JSON.parse(route.request().postData()).action === 'CONFIRM_RETURN') { loseReturn = false; const result = await route.fetch(); assert.equal(result.status(), 200); await route.abort('failed') }
    else await route.continue()
  })
  await driver.getByRole('button', { name: 'Ghi nhận đã trả hàng', exact: true }).click(); assert.equal(returns.length, 1)
  await driver.getByRole('button', { name: 'Xác nhận đã trả kiện', exact: true }).evaluate(element => { element.click(); element.click() })
  await driver.getByRole('button', { name: 'Thử lại đúng thao tác đang chờ', exact: true }).waitFor()
  assert.equal(await driver.getByRole('dialog').count(), 0, 'Dialog không được che lỗi/retry')
  assert.equal(returns.length, 2)
  await driver.getByRole('button', { name: 'Thử lại đúng thao tác đang chờ', exact: true }).click()
  await driver.getByText('Thao tác D10 đã được ghi nhận; không xử lý trùng.', { exact: true }).waitFor(); assert.equal(returns.length, 3)
  await driver.reload(); await driver.getByText('Người nhận kiện trả:', { exact: false }).waitFor()
  for (const page of [driver, seller, buyer]) {
    await page.goto(origin + `/orders/${fixture.orderId}/tracking`)
    await page.getByRole('heading', { name: 'Đã trả hàng cho người bán', exact: true }).waitFor()
    await page.getByText('Theo dõi yêu cầu B06–B07 hiện có; trả kiện không đồng nghĩa đã hoàn tiền.', { exact: true }).waitFor()
    await page.getByText('Người nhận kiện trả: Người bán fixture', { exact: true }).waitFor()
  }
  assert.equal(await driver.getByText('Không liên hệ được người nhận: <b>Người nhận vẫn vắng</b>', { exact: true }).first().locator('b').count(), 0)
  assert.equal(pageErrors.length, 0)
  await driver.screenshot({ path: path.join(frontend, 'test-results/d10-production-returned.png'), fullPage: true })
  console.log('PASS D10 UI nhánh B: chuyển hoàn có dialog → buyer tự gửi B06 đúng đơn → REFUND_PENDING vẫn trả kiện → D05 ba vai trò; không hoàn tiền giả')
} catch (e) {
  // Không in message/stack của Playwright vì có thể chứa giá trị fill/mã D08.
  console.error(`FAIL D10 UI tại bước ${stage}: ${e.name || 'Error'}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (child && child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped }
}
