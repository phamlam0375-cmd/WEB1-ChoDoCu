import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.D08_BROWSER_TEST !== 'true' || !process.env.D08_EXPECTED_MYSQL_UUID || !process.env.D08_PLAYWRIGHT_MODULE) throw new Error('Cần bật D08_BROWSER_TEST, UUID MySQL local và module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), frontend = path.join(root, 'frontend'), dist = path.join(frontend, 'dist')
const prefix = `d08_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
const containerName = `web1-chodocu-d08-browser-${Date.now()}`
const docker = args => execFileSync('docker', args, { encoding: 'utf8', env: { ...process.env, D08_BROWSER_TEST_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
let created = false, server, browser, stage = 'khởi tạo'
try {
  const inspect = JSON.parse(docker(['inspect', 'web1-chodocu-api-1']))[0]
  assert.ok(inspect.Mounts.some(m => m.Destination === '/app' && path.resolve(m.Source).toLowerCase() === path.join(root, 'backend').toLowerCase()), 'Phải dùng source local')
  const network = Object.keys(inspect.NetworkSettings.Networks).find(name => name.startsWith('web1-chodocu'))
  assert.ok(network, 'Không dùng network CD')
  docker(['run', '--detach', '--rm', '--name', containerName, '--network', network, '--volumes-from', 'web1-chodocu-api-1:ro',
    '--tmpfs', '/app/uploads:rw,nosuid,nodev,size=67108864', '--env-file', path.join(root, 'backend/.env'),
    '-e', 'NODE_ENV=test', '-e', 'DB_HOST=mysql', '-e', 'DB_PORT=3306', '-e', 'DB_NAME=cho_do_cu_d08_20261026',
    '-e', 'D08_INTEGRATION_TEST=true', '-e', `D08_EXPECTED_MYSQL_UUID=${process.env.D08_EXPECTED_MYSQL_UUID}`,
    '-e', `D08_BROWSER_PREFIX=${prefix}`, '-e', 'D08_BROWSER_TEST_PASSWORD', '-e', 'JWT_SECRET=d08-browser-test-only-no-real-users',
    '-e', 'EMAIL_USER=', '-e', 'EMAIL_PASS=', '-e', 'MAIL_USER=', '-e', 'MAIL_PASS=',
    '-p', '127.0.0.1::3000', inspect.Image, 'node', 'scripts/serve-pickup-test.js'])
  created = true
  let fixture
  for (let attempt = 0; attempt < 60; attempt++) {
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
  const { chromium } = await import(pathToFileURL(process.env.D08_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await c.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
    return c
  }
  const driver = await (await context()).newPage(), seller = await (await context()).newPage(), pageErrors = []
  for (const p of [driver, seller]) p.on('pageerror', () => pageErrors.push(true))
  const login = async (page, label, destination) => {
    await page.goto(origin + destination); await page.waitForURL(/\/login\?returnTo=/)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), destination)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  let pickupCalls = 0, issueCalls = 0
  driver.on('request', req => { if (req.method() === 'PATCH' && req.url().endsWith('/pickup')) pickupCalls++ })
  seller.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/pickup-code')) issueCalls++ })
  stage = 'đăng nhập và chờ bàn giao'
  await login(driver, 'browserdriver', `/driver/deliveries/${fixture.deliveryId}/pickup`)
  await driver.getByText('Chờ đúng người bán chủ động xác nhận bàn giao và cung cấp mã lấy hàng.', { exact: true }).waitFor()
  assert.equal(pickupCalls, 0)
  console.log('PASS D08 UI: đăng nhập giữ returnTo, không tự lấy hàng, chờ người bán bàn giao')
  stage = 'người bán cấp mã'
  await login(seller, 'seller', `/seller/orders/${fixture.orderId}/pickup-code`)
  const issueButton = seller.getByRole('button', { name: 'Xác nhận bàn giao và cấp mã', exact: true })
  await issueButton.waitFor(); assert.ok(await issueButton.isDisabled())
  await seller.getByRole('checkbox').check()
  await issueButton.evaluate(element => { element.click(); element.click() })
  const output = seller.locator('output[aria-label="Mã lấy hàng"]'); await output.waitFor()
  const code = (await output.textContent()).trim(); assert.ok(/^\d{6}$/.test(code), 'Mã phải có định dạng chuỗi hợp lệ')
  assert.equal(issueCalls, 1)
  await seller.reload(); await seller.getByRole('button', { name: 'Cấp lại mã lấy hàng', exact: true }).waitFor()
  assert.equal(await seller.locator('output[aria-label="Mã lấy hàng"]').count(), 0)
  assert.equal(issueCalls, 1)
  console.log('PASS D08 UI: seller chủ động bàn giao/cấp mã đúng một lần; reload không lộ hay tự cấp lại mã')
  stage = 'tài xế xác nhận và ảnh'
  await driver.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await driver.getByText('Mã có hiệu lực đến', { exact: false }).waitFor()
  await driver.locator('#pickup-code').fill(code)
  const pickupButton = driver.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true })
  assert.ok(await pickupButton.isDisabled())
  await driver.getByRole('checkbox').check()
  const png = Buffer.from(docker(['exec', containerName, 'node', '-e', "process.stdout.write(require('./tests/D03_ThanhToan/fixtures').pngReceipt().toString('base64'))"]), 'base64')
  await driver.locator('#pickup-proof').setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: png })
  await driver.getByText('Chỉ chấp nhận JPG hoặc PNG tối đa 5 MB.', { exact: true }).waitFor()
  await driver.locator('#pickup-proof').setInputFiles({ name: 'pickup.png', mimeType: 'image/png', buffer: png })
  await pickupButton.evaluate(element => { element.click(); element.click() })
  await driver.getByText('Đã nhận kiện; chuyến chuyển sang PICKED_UP.', { exact: true }).waitFor()
  assert.equal(pickupCalls, 1)
  await driver.reload(); await driver.getByRole('link', { name: 'Mở tiến trình D05', exact: true }).waitFor()
  await driver.waitForFunction(() => [...document.images].some(image => image.alt.startsWith('Bằng chứng lấy hàng') && image.complete && image.naturalWidth > 0))
  assert.equal(await driver.locator('#pickup-code').count(), 0)
  assert.ok(!await driver.evaluate(value => Object.values(localStorage).some(item => String(item).includes(value)), code), 'Không persist mã vào localStorage')
  await driver.screenshot({ path: path.join(frontend, 'test-results/d08-production-picked-up.png'), fullPage: true })
  console.log('PASS D08 UI: checkbox + kiểm tra ảnh, PATCH một lần, reload PICKED_UP và đọc ảnh có JWT')
  stage = 'D05 timeline'
  await driver.getByRole('link', { name: 'Mở tiến trình D05', exact: true }).click()
  await driver.getByText('Tài xế đối chiếu mã và xác nhận đúng kiện, kiện còn nguyên vẹn.', { exact: true }).waitFor()
  await driver.getByText('Thực hiện: D08 fixture browserdriver', { exact: true }).first().waitFor()
  await seller.goto(origin + `/orders/${fixture.orderId}/tracking`)
  await seller.getByText('Tài xế đối chiếu mã và xác nhận đúng kiện, kiện còn nguyên vẹn.', { exact: true }).waitFor()
  assert.equal(pageErrors.length, 0)
  console.log('PASS D08 production: seller bàn giao/cấp mã → driver BUSY xác nhận + ảnh → reload → D05 đúng timeline/người thực hiện. Không email/CD, không log mã/token.')
} catch (e) {
  // Playwright có thể đưa giá trị fill vào lỗi: không in error.message/stack chứa mã.
  console.error(`FAIL D08 UI tại bước ${stage}: ${e.name || 'Error'}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (created) docker(['stop', containerName])
}
