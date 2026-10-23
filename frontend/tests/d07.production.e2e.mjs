// Chạy sau pnpm build. Playwright chỉ là công cụ kiểm thử đã cài ngoài repo,
// không thêm dependency runtime, không dùng Chrome/profile đang mở của người dùng.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.D07_BROWSER_TEST !== 'true' || !process.env.D07_EXPECTED_MYSQL_UUID || !process.env.D07_PLAYWRIGHT_MODULE) throw new Error('Cần bật D07_BROWSER_TEST và chỉ định UUID MySQL local/module Playwright đã cài.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const frontend = path.join(root, 'frontend'), dist = path.join(frontend, 'dist')
const prefix = `d07_ui_${Date.now()}_${randomBytes(2).toString('hex')}`
const password = randomBytes(24).toString('base64url')
const containerName = 'web1-chodocu-d07-browser-' + Date.now()
const docker = args => execFileSync('docker', args, { encoding: 'utf8', env: { ...process.env, D07_BROWSER_TEST_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
let created = false, staticServer, browser
try {
  const inspect = JSON.parse(docker(['inspect', 'web1-chodocu-api-1']))[0]
  assert.ok(inspect.Mounts.some(m => m.Destination === '/app' && path.resolve(m.Source).toLowerCase() === path.join(root, 'backend').toLowerCase()), 'Chỉ dùng backend source local')
  const network = Object.keys(inspect.NetworkSettings.Networks).find(name => name.startsWith('web1-chodocu'))
  assert.ok(network, 'Không được dùng network CD')
  docker(['run', '--detach', '--rm', '--name', containerName, '--network', network, '--volumes-from', 'web1-chodocu-api-1:ro',
    '--env-file', path.join(root, 'backend/.env'), '-e', 'NODE_ENV=test', '-e', 'DB_HOST=mysql', '-e', 'DB_PORT=3306',
    '-e', 'DB_NAME=cho_do_cu_d07_20261023', '-e', 'D07_INTEGRATION_TEST=true', '-e', 'D07_HEADLESS_SERVER=true',
    '-e', `D07_EXPECTED_MYSQL_UUID=${process.env.D07_EXPECTED_MYSQL_UUID}`, '-e', `D07_BROWSER_PREFIX=${prefix}`, '-e', 'D07_BROWSER_TEST_PASSWORD',
    '-e', 'EMAIL_USER=', '-e', 'EMAIL_PASS=', '-e', 'MAIL_USER=', '-e', 'MAIL_PASS=', '-e', 'JWT_SECRET=d07-browser-test-only-no-real-users',
    '-p', '127.0.0.1::3000', inspect.Image, 'node', 'scripts/verify-driver-assignment.js'])
  created = true
  let fixture
  for (let attempt = 0; attempt < 60; attempt++) {
    const match = docker(['logs', containerName]).match(/D07_BROWSER_FIXTURE (\{[^\n]+\})/)
    if (match) { fixture = JSON.parse(match[1]); break }
    if (docker(['inspect', '--format', '{{.State.Running}}', containerName]) !== 'true') throw new Error('Fixture server dừng trước khi sẵn sàng.')
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(fixture, 'Fixture server chưa sẵn sàng; không in log chứa credential')
  const port = Number(docker(['port', containerName, '3000/tcp']).split(':').at(-1))
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
  staticServer = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      upstream.on('error', () => { res.writeHead(502); res.end('Test API unavailable') }); req.pipe(upstream); return
    }
    try {
      const url = new URL(req.url, 'http://localhost'), relative = decodeURIComponent(url.pathname)
      const file = path.resolve(dist, '.' + relative)
      if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(400); res.end(); return }
      let bytes
      try { bytes = await readFile(file); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream') }
      catch { bytes = await readFile(path.join(dist, 'index.html')); res.setHeader('Content-Type', 'text/html; charset=utf-8') }
      res.end(bytes)
    } catch { res.writeHead(500); res.end() }
  })
  staticServer.listen(0, '127.0.0.1'); await new Promise(resolve => staticServer.once('listening', resolve))
  const origin = `http://127.0.0.1:${staticServer.address().port}`
  const { chromium } = await import(pathToFileURL(process.env.D07_PLAYWRIGHT_MODULE).href)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  let patches = 0
  page.on('request', req => { if (req.method() === 'PATCH' && req.url().endsWith('/accept')) patches++ })
  const login = async label => {
    await page.locator('#login-email').fill(`${prefix}_${label}@example.test`)
    await page.locator('#login-password').fill(password)
    await page.locator('.login-submit').click()
    await page.waitForURL(origin + '/driver/deliveries')
  }
  await page.goto(origin + '/driver/deliveries')
  await page.waitForURL(/\/login\?returnTo=/)
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/driver/deliveries')
  console.log('PASS production: guest chuyển tới login, giữ returnTo D07')
  await page.locator('#login-email').fill(`${prefix}_browserdriver@example.test`); await page.locator('#login-password').fill('invalid-password-fixture')
  await page.locator('.login-submit').click(); await page.getByRole('alert').waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  await login('browserdriver')
  await page.getByRole('heading', { name: `Chuyến #${fixture.deliveryId}`, exact: true }).waitFor()
  await page.screenshot({ path: path.join(frontend, 'test-results/d07-production-available.png'), fullPage: true })
  assert.equal(patches, 0, 'Không tự nhận chuyến sau login')
  console.log('PASS production: login sai/đúng, mở danh sách thật, không tự nhận chuyến')
  await page.getByRole('heading', { name: `Chuyến #${fixture.deliveryId}`, exact: true }).locator('..').getByRole('button', { name: 'Nhận chuyến', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Xác nhận nhận chuyến', exact: true }).click()
  await page.getByRole('link', { name: 'Mở thông tin chuyến đã nhận' }).waitFor()
  assert.equal(patches, 1)
  console.log('PASS production: dialog xác nhận, PATCH đúng một lần, backend xác nhận thành công')
  await page.reload(); await page.getByRole('link', { name: new RegExp(`Theo dõi chuyến #${fixture.deliveryId}`) }).waitFor()
  await page.getByRole('link', { name: new RegExp(`Theo dõi chuyến #${fixture.deliveryId}`) }).click()
  await page.getByText(`Chuyến #${fixture.deliveryId} · Tài xế đã nhận chuyến`, { exact: true }).waitFor()
  assert.ok(await page.getByText('Tài xế đã nhận chuyến; chưa xác nhận lấy hàng.', { exact: true }).count())
  await page.screenshot({ path: path.join(frontend, 'test-results/d07-production-tracking.png'), fullPage: true })
  await page.locator('button[aria-label="Đăng xuất"]').click()
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  for (const [label, text] of [['browserplain', 'Chưa đăng ký DRIVER tại C01'], ['browserpending', 'Đang chờ B02 duyệt'], ['browseroffline', 'Hãy bật trạng thái sẵn sàng nhận chuyến.']]) {
    await page.goto(origin + '/driver/deliveries'); await page.waitForURL(/\/login\?returnTo=/); await login(label)
    await page.getByText(text, { exact: label !== 'browseroffline' }).waitFor()
    if (label === 'browserplain') {
      await page.getByRole('link', { name: 'Mở hồ sơ đối tác DRIVER (C01)' }).click()
      await page.waitForURL(/\/partner-application\?type=DRIVER/)
      await page.waitForFunction(email => document.querySelector('input[type=email]')?.value === email, `${prefix}_browserplain@example.test`)
      assert.equal(await page.locator('input[type=email]').inputValue(), `${prefix}_browserplain@example.test`)
    }
    await page.locator('button[aria-label="Đăng xuất"]').click()
  }
  assert.deepEqual(errors, [])
  console.log('PASS D07 production UI: guest → login sai/đúng → không tự accept → xác nhận nhận → reload BUSY → D05 timeline; C01/PENDING/OFFLINE; logout xóa JWT; không pageerror. Không email, không CD.')
} finally {
  if (browser) await browser.close()
  if (staticServer) { staticServer.closeAllConnections(); await new Promise(resolve => staticServer.close(resolve)) }
  if (created) docker(['stop', containerName])
}
