import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.D09_BROWSER_TEST !== 'true' || !process.env.D09_EXPECTED_MYSQL_UUID || !process.env.D09_PLAYWRIGHT_MODULE) throw new Error('Cần bật D09_BROWSER_TEST, UUID MySQL local và module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), frontend = path.join(root, 'frontend'), dist = path.join(frontend, 'dist')
const prefix = `d09_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
const containerName = `web1-chodocu-d09-browser-${Date.now()}`
const docker = args => execFileSync('docker', args, { encoding: 'utf8', env: { ...process.env, D09_BROWSER_TEST_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
let created = false, server, browser, stage = 'khởi tạo'
try {
  const inspect = JSON.parse(docker(['inspect', 'web1-chodocu-api-1']))[0]
  assert.ok(inspect.Mounts.some(m => m.Destination === '/app' && path.resolve(m.Source).toLowerCase() === path.join(root, 'backend').toLowerCase()), 'Chỉ dùng source local')
  const network = Object.keys(inspect.NetworkSettings.Networks).find(name => name.startsWith('web1-chodocu'))
  assert.ok(network, 'Không dùng network CD')
  docker(['run', '--detach', '--rm', '--name', containerName, '--network', network, '--volumes-from', 'web1-chodocu-api-1:ro',
    '--tmpfs', '/app/uploads:rw,nosuid,nodev,size=67108864', '--env-file', path.join(root, 'backend/.env'),
    '-e', 'NODE_ENV=test', '-e', 'DB_HOST=mysql', '-e', 'DB_PORT=3306', '-e', 'DB_NAME=cho_do_cu_d09_20261026',
    '-e', 'D09_INTEGRATION_TEST=true', '-e', 'D09_BROWSER_RECEIVE=true', '-e', `D09_EXPECTED_MYSQL_UUID=${process.env.D09_EXPECTED_MYSQL_UUID}`,
    '-e', `D09_BROWSER_PREFIX=${prefix}`, '-e', 'D09_BROWSER_TEST_PASSWORD', '-e', 'JWT_SECRET=d09-browser-test-only-no-real-users',
    '-e', 'EMAIL_USER=', '-e', 'EMAIL_PASS=', '-e', 'MAIL_USER=', '-e', 'MAIL_PASS=',
    '-p', '127.0.0.1::3000', inspect.Image, 'node', 'scripts/serve-pickup-test.js'])
  created = true
  let fixture
  for (let attempt = 0; attempt < 60; attempt++) {
    // Tái sử dụng fixture D07/C07; mã D08 chỉ được cấp chủ động qua UI seller.
    const match = docker(['logs', containerName]).match(/D08_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(fixture, 'Fixture test chưa sẵn sàng')
  const port = Number(docker(['port', containerName, '3000/tcp']).split(':').at(-1))
  server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      upstream.on('error', () => { res.writeHead(502); res.end() }); req.pipe(upstream); return
    }
    const target = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
    if (target !== dist && !target.startsWith(dist + path.sep)) { res.writeHead(400); res.end(); return }
    try { const bytes = await readFile(target); res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream'); res.end(bytes) }
    catch { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile(path.join(dist, 'index.html'))) }
  })
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const { chromium } = await import(pathToFileURL(process.env.D09_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
    await c.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
    return c
  }
  const driver = await (await context()).newPage(), seller = await (await context()).newPage(), buyer = await (await context()).newPage(), pageErrors = []
  for (const page of [driver, seller, buyer]) page.on('pageerror', () => pageErrors.push(true))
  const login = async (page, label, destination) => {
    await page.goto(origin + destination); await page.waitForURL(/\/login\?returnTo=/)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), destination)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  stage = 'D07/D08 qua giao diện'
  await login(driver, 'browserdriver', '/driver/deliveries')
  await driver.getByRole('heading', { name: `Chuyến #${fixture.deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await driver.getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await driver.getByRole('link', { name: 'Xác nhận đã lấy hàng', exact: true }).first().click()
  await login(seller, 'seller', `/seller/orders/${fixture.orderId}/pickup-code`)
  await seller.getByRole('checkbox').check(); await seller.getByRole('button', { name: 'Xác nhận bàn giao và cấp mã', exact: true }).click()
  const output = seller.locator('output[aria-label="Mã lấy hàng"]'); await output.waitFor()
  const code = (await output.textContent()).trim(); assert.ok(/^\d{6}$/.test(code), 'Mã phải có định dạng hợp lệ')
  await driver.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await driver.getByText('Mã có hiệu lực đến', { exact: false }).waitFor(); await driver.locator('#pickup-code').fill(code)
  await driver.getByRole('checkbox').check()
  const png = Buffer.from(docker(['exec', containerName, 'node', '-e', "process.stdout.write(require('./tests/D03_ThanhToan/fixtures').pngReceipt().toString('base64'))"]), 'base64')
  await driver.locator('#pickup-proof').setInputFiles({ name: 'pickup.png', mimeType: 'image/png', buffer: png })
  await driver.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
  await driver.getByText('Đã nhận kiện; chuyến chuyển sang PICKED_UP.', { exact: true }).waitFor()
  await driver.getByRole('link', { name: 'Cập nhật tiến độ giao hàng', exact: true }).click()
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).waitFor()
  console.log('PASS D09 UI: đăng nhập thật → nhận chuyến D07 qua UI → seller bàn giao → D08 mã + ảnh → mở D09')
  const requests = []
  driver.on('request', req => { if (req.method() === 'PATCH' && req.url().endsWith('/status')) requests.push({ key: req.headers()['idempotency-key'], body: JSON.parse(req.postData()) }) })
  stage = 'mất phản hồi sau commit và retry'
  assert.equal(requests.length, 0)
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).click()
  await driver.getByText('Vui lòng chọn trạng thái giao hàng.', { exact: true }).waitFor(); assert.equal(requests.length, 0)
  await driver.locator('#delivery-progress-status').selectOption('DELIVERING')
  const initialNote = 'Đã rời điểm lấy, bắt đầu giao'
  await driver.locator('#delivery-progress-note').fill(initialNote)
  let lose = true
  await driver.route('**/api/v1/driver/deliveries/*/status', async route => {
    if (lose) { lose = false; const result = await route.fetch(); assert.equal(result.status(), 200); await route.abort('failed') }
    else await route.continue()
  })
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).click()
  await driver.getByRole('alert').waitFor(); assert.equal(await driver.locator('#delivery-progress-note').inputValue(), initialNote)
  await driver.getByRole('button', { name: 'Lưu ghi chú tiến độ mới', exact: true }).click()
  await driver.getByText('Thao tác đã được ghi nhận trước đó; không cập nhật trùng.', { exact: true }).waitFor()
  assert.equal(requests.length, 2); assert.equal(requests[0].key, requests[1].key); assert.equal(requests[1].body.action, 'START')
  assert.equal(await driver.locator('#delivery-progress-note').inputValue(), '')
  console.log('PASS D09 UI: server commit nhưng mất phản hồi → giữ ghi chú → retry cùng khóa và START, không tạo NOTE nhầm')
  stage = 'ghi chú mới có chủ đích'
  const text = '<b>Đang di chuyển tới điểm giao</b>'
  for (let i = 0; i < 2; i++) {
    await driver.locator('#delivery-progress-status').selectOption('DELIVERING'); await driver.locator('#delivery-progress-note').fill(text)
    await driver.getByRole('button', { name: 'Lưu ghi chú tiến độ mới', exact: true }).evaluate(element => { element.click(); element.click() })
    await driver.getByText('Đã cập nhật tiến độ giao hàng.', { exact: true }).waitFor()
    await driver.waitForFunction(() => document.querySelector('#delivery-progress-note')?.value === '')
  }
  assert.equal(requests.length, 4); assert.notEqual(requests[2].key, requests[3].key)
  await driver.reload(); await driver.getByRole('button', { name: 'Lưu ghi chú tiến độ mới', exact: true }).waitFor(); assert.equal(requests.length, 4)
  assert.deepEqual(await driver.locator('#delivery-progress-status option').evaluateAll(nodes => nodes.map(node => node.value)), ['', 'DELIVERING'])
  await driver.getByText('D13 chưa triển khai.', { exact: false }).waitFor()
  await driver.screenshot({ path: path.join(frontend, 'test-results/d09-production-delivering.png'), fullPage: true })
  console.log('PASS D09 UI: hai ghi chú cùng câu nhưng ý định mới có hai khóa; double-click không gửi lặp; reload không tự cập nhật')
  stage = 'D05 của driver/buyer/seller và D07 mở lại chuyến'
  await driver.getByRole('link', { name: 'Xem lịch sử tiến độ D05', exact: true }).click()
  await driver.getByText(text, { exact: true }).first().waitFor(); assert.equal(await driver.getByText(text, { exact: true }).count(), 2)
  assert.equal(await driver.getByText(text, { exact: true }).first().locator('b').count(), 0)
  assert.equal(await driver.getByText('Ghi chú tiến độ giao hàng', { exact: true }).count(), 2)
  await driver.getByText('Thực hiện: D09 fixture browserdriver', { exact: true }).first().waitFor()
  await driver.waitForFunction(() => [...document.images].some(image => image.alt.startsWith('Bằng chứng lấy hàng') && image.complete && image.naturalWidth > 0))
  await seller.goto(origin + `/orders/${fixture.orderId}/tracking`); await seller.getByText(text, { exact: true }).first().waitFor()
  await login(buyer, 'buyer', `/orders/${fixture.orderId}/tracking`); await buyer.getByText(text, { exact: true }).first().waitFor()
  await driver.goto(origin + '/driver/deliveries'); await driver.getByRole('link', { name: 'Cập nhật tiến độ giao hàng', exact: true }).click()
  await driver.getByRole('button', { name: 'Lưu ghi chú tiến độ mới', exact: true }).waitFor()
  assert.equal(pageErrors.length, 0)
  console.log('PASS D09 production: D07 → D08 → D09 → D05 buyer/seller/driver; ghi chú là text, ảnh D08 còn nguyên, không vượt D13. Không email/CD/log bí mật.')
} catch (e) {
  console.error(`FAIL D09 UI tại bước ${stage}: ${e.name || 'Error'}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (created) docker(['stop', containerName])
}
