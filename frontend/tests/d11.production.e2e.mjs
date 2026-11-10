import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.D11_BROWSER_TEST !== 'true' || !process.env.D11_EXPECTED_MYSQL_UUID || !process.env.D11_PLAYWRIGHT_MODULE) throw new Error('Cần D11_BROWSER_TEST, UUID MySQL local và module Playwright có sẵn.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), backend = path.join(root, 'backend'), dist = path.join(root, 'frontend/dist')
const prefix = `d11_ui_${Date.now()}_${randomBytes(2).toString('hex')}`, password = randomBytes(24).toString('base64url')
const { pngReceipt } = createRequire(import.meta.url)(path.join(backend, 'tests/D03_ThanhToan/fixtures'))
let child, server, browser, output = '', stage = 'khởi tạo'
try {
  child = spawn(process.execPath, ['scripts/serve-pickup-test.js'], { cwd: backend, windowsHide: true, env: { ...process.env,
    NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: '33307', DB_NAME: 'cho_do_cu_d11_20261106', DB_LOGGING: 'false',
    D11_INTEGRATION_TEST: 'true', D11_BROWSER_PREFIX: prefix, D11_BROWSER_TEST_PASSWORD: password, D11_BROWSER_PORT: '0', D11_BROWSER_HOST: '127.0.0.1',
    JWT_SECRET: 'd11-browser-isolated-test-no-real-users', EMAIL_USER: '', EMAIL_PASS: '', MAIL_USER: '', MAIL_PASS: '', SMTP_USER: '', SMTP_PASS: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', bytes => { output += bytes.toString() }); child.stderr.on('data', () => {})
  let fixture
  for (let i = 0; i < 100; i++) {
    const match = output.match(/D08_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    if (child.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(fixture?.apiPort, 'Source API fixture chưa sẵn sàng')
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
  const origin = `http://127.0.0.1:${server.address().port}`
  const { chromium } = await import(pathToFileURL(process.env.D11_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Asia/Ho_Chi_Minh' })
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url().startsWith('blob:') ? route.continue() : route.abort())
  const driver = await context.newPage(), seller = await (await browser.newContext()).newPage(), pageErrors = []
  driver.on('pageerror', () => pageErrors.push(true))
  const login = async (page, label, destination) => {
    await page.goto(origin + destination); await page.waitForURL(/\/login\?returnTo=/)
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`); await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click(); await page.waitForURL(origin + destination)
  }
  stage = 'menu + tạo hồ sơ + refresh'
  await login(driver, 'browserdriver', '/driver/deliveries')
  await driver.getByRole('link', { name: 'Hồ sơ tài xế', exact: true }).click(); await driver.getByText('Chưa có hồ sơ vận hành.', { exact: false }).waitFor()
  const field = key => driver.locator(`#driver-${key}`)
  await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await driver.getByText('Vui lòng nhập đầy đủ thông tin vận hành.', { exact: true }).first().waitFor()
  for (const [key, value] of Object.entries({ VehicleType: 'MOTORBIKE', VehiclePlate: '59a TEST', ServiceArea: 'AREA_1', BankName: 'TEST BANK', BankAccountNumber: '00001234', BankAccountHolder: 'TEST DRIVER' })) await field(key).fill(value)
  let saves = 0
  driver.on('request', req => { if (req.method() === 'PATCH' && req.url().endsWith('/driver/profile')) saves++ })
  await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).evaluate(button => { button.click(); button.click() })
  await driver.getByText('Đã cập nhật hồ sơ vận hành.', { exact: true }).waitFor(); assert.equal(saves, 1)
  await driver.getByRole('button', { name: 'Bật nhận chuyến', exact: true }).click()
  await driver.getByTestId('driver-availability').getByText('AVAILABLE', { exact: true }).waitFor()
  await driver.reload(); await driver.getByTestId('driver-availability').getByText('AVAILABLE', { exact: true }).waitFor()
  assert.equal(await field('BankAccountNumber').inputValue(), '00001234'); assert.equal(await field('MaxDistanceKm').inputValue(), '')
  console.log('PASS D11 UI: JWT login, menu, validate fields, tạo OFFLINE, bank-only AVAILABLE, chặn submit lặp, reload giữ số 0/radius NULL')
  stage = '409 giữ input + QR-only'
  for (const key of ['BankName', 'BankAccountNumber', 'BankAccountHolder']) await field(key).fill('')
  await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await driver.getByText('Vui lòng bổ sung tài khoản hoặc QR nhận phí. Hãy chuyển OFFLINE trước khi xóa phương thức cuối cùng.', { exact: true }).waitFor()
  assert.equal(await field('BankAccountNumber').inputValue(), '')
  await driver.getByRole('button', { name: 'Bỏ thay đổi và tải lại', exact: true }).click()
  await driver.getByRole('button', { name: 'Tắt nhận chuyến', exact: true }).click()
  await driver.getByTestId('driver-availability').getByText('OFFLINE', { exact: true }).waitFor()
  for (const key of ['BankName', 'BankAccountNumber', 'BankAccountHolder']) await field(key).fill('')
  await driver.getByLabel('Chọn QR nhận phí').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: pngReceipt() })
  await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await driver.getByText('Đã cập nhật hồ sơ vận hành.', { exact: true }).waitFor()
  await driver.reload(); await driver.getByAltText('QR nhận phí của bạn').waitFor()
  await driver.waitForFunction(() => document.querySelector('img[alt="QR nhận phí của bạn"]')?.naturalWidth > 0)
  await driver.getByRole('button', { name: 'Bật nhận chuyến', exact: true }).click(); await driver.getByTestId('driver-availability').getByText('AVAILABLE', { exact: true }).waitFor()
  console.log('PASS D11 UI: backend 409 giữ input, chủ động bỏ thay đổi, upload QR riêng tư, QR-only AVAILABLE, ảnh tải lại sau refresh')
  stage = 'D07 nhận chuyến -> BUSY'
  await driver.getByRole('main').getByRole('link', { name: 'Chuyến tài xế', exact: true }).click()
  await driver.getByRole('heading', { name: `Chuyến #${fixture.deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await driver.getByRole('link', { name: 'Hồ sơ tài xế', exact: true }).click()
  await driver.getByTestId('driver-availability').getByText('BUSY', { exact: true }).waitFor()
  assert.equal(await field('VehiclePlate').isDisabled(), true); assert.equal(await driver.getByRole('button', { name: 'Tắt nhận chuyến', exact: true }).isDisabled(), true)
  await driver.getByRole('link', { name: 'Theo dõi chuyến đang phụ trách', exact: true }).waitFor()
  console.log('PASS D11 UI: D07 nhận chuyến thật -> BUSY và liên kết chuyến; khóa hồ sơ/tắt nhận khi đang giữ nhiệm vụ')
  stage = 'D08 D09 D10 trả hàng'
  await login(seller, 'seller', `/seller/orders/${fixture.orderId}/pickup-code`)
  await seller.getByRole('checkbox').check(); await seller.getByRole('button', { name: 'Xác nhận bàn giao và cấp mã', exact: true }).click()
  const code = (await seller.locator('output[aria-label="Mã lấy hàng"]').textContent()).trim()
  await driver.goto(`${origin}/driver/deliveries/${fixture.deliveryId}/pickup`); await driver.locator('#pickup-code').fill(code)
  await driver.getByRole('checkbox').check(); await driver.getByRole('button', { name: 'Xác nhận đã lấy hàng', exact: true }).click()
  await driver.getByText('Đã nhận kiện; chuyến chuyển sang PICKED_UP.', { exact: true }).waitFor()
  await driver.getByRole('link', { name: 'Cập nhật tiến độ giao hàng', exact: true }).click()
  await driver.locator('#delivery-progress-status').selectOption('DELIVERING'); await driver.locator('#delivery-progress-note').fill('Bắt đầu giao test D11')
  await driver.getByRole('button', { name: 'Bắt đầu giao hàng', exact: true }).click(); await driver.getByText('Đã cập nhật tiến độ giao hàng.', { exact: true }).waitFor()
  await driver.getByRole('link', { name: 'Giao không thành công / Chuyển hoàn', exact: true }).click()
  await driver.locator('#failure-reason').selectOption('UNAVAILABLE'); await driver.getByRole('button', { name: 'Ghi nhận giao thất bại', exact: true }).click()
  await driver.getByText('Đã ghi nhận lần giao thất bại thứ 1.', { exact: true }).waitFor()
  await driver.goto(origin + '/driver/profile'); await driver.getByText(`Chuyến #${fixture.deliveryId} · FAILED.`, { exact: false }).waitFor()
  assert.equal(await driver.getByRole('button', { name: 'Bật nhận chuyến', exact: true }).isDisabled(), true)
  await driver.goto(`${origin}/driver/deliveries/${fixture.deliveryId}/failure`)
  await driver.getByRole('button', { name: 'Chuyển hoàn', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Xác nhận chuyển hoàn', exact: true }).click()
  await driver.getByText('Đã chuyển sang RETURNING và thông báo cho các bên.', { exact: true }).waitFor()
  await driver.locator('#return-recipient').fill('Fixture seller'); await driver.locator('#return-confirmed').check()
  await driver.getByRole('button', { name: 'Ghi nhận đã trả hàng', exact: true }).click()
  await driver.getByRole('dialog').getByRole('button', { name: 'Xác nhận đã trả kiện', exact: true }).click()
  await driver.getByText('Đã ghi nhận bàn giao trả hàng. Đây không phải xác nhận đã hoàn tiền.', { exact: true }).waitFor()
  await driver.goto(origin + '/driver/profile'); await driver.getByTestId('driver-availability').getByText('OFFLINE', { exact: true }).waitFor()
  assert.equal(await field('VehiclePlate').isDisabled(), false)
  await driver.getByRole('button', { name: 'Xóa QR', exact: true }).click(); await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await driver.getByText('Đã cập nhật hồ sơ vận hành.', { exact: true }).waitFor(); await driver.reload()
  await driver.getByTestId('driver-availability').getByText('OFFLINE', { exact: true }).waitFor()
  assert.equal(await driver.getByAltText('QR nhận phí của bạn').count(), 0)
  assert.equal(await driver.getByRole('button', { name: 'Bật nhận chuyến', exact: true }).isDisabled(), true)
  assert.equal(pageErrors.length, 0)
  await mkdir(path.join(root, 'frontend/test-results'), { recursive: true })
  await driver.screenshot({ path: path.join(root, 'frontend/test-results/d11-profile-production.png'), fullPage: true })
  await driver.setViewportSize({ width: 390, height: 844 })
  assert.equal(await driver.getByRole('main').evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Form D11 không tràn ngang trên mobile')
  await driver.screenshot({ path: path.join(root, 'frontend/test-results/d11-profile-mobile.png'), fullPage: true })
  console.log(`PASS D11 UI: production ${origin}/driver/profile; D08-D09-D10 thật -> FAILED khóa -> RETURNED về OFFLINE; xóa QR bền vững; không lỗi JS. D13 chưa triển khai.`)
} catch (error) { console.error(`D11 production UI failed (${stage}):`, error.name, error.message); process.exitCode = 1 }
finally { if (browser) await browser.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } if (child) child.kill() }
