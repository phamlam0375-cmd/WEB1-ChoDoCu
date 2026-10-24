// Opt-in local integration: tạo fixture riêng, đăng nhập thật; không log/lưu mật khẩu/token.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

if (process.env.LOCAL_D06_TEST !== 'true') throw new Error('Set LOCAL_D06_TEST=true to create isolated local fixtures')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
const mysql = JSON.parse(docker('inspect', 'web1-chodocu-mysql-1'))[0]
const api = JSON.parse(docker('inspect', 'web1-chodocu-api-1'))[0]
assert.equal(mysql.Config.Labels['com.docker.compose.project'], 'web1-chodocu')
assert(mysql.Mounts.some(m => m.Name === 'web1-chodocu_mysql_data' && m.Destination === '/var/lib/mysql'))
assert(mysql.HostConfig.PortBindings['3306/tcp'].some(p => p.HostPort === '33307' && p.HostIp === '127.0.0.1'))
assert.equal(api.Config.Labels['com.docker.compose.project'], 'web1-chodocu')
assert.equal(path.resolve(api.Mounts.find(m => m.Destination === '/app').Source), path.join(root, 'backend'))
assert(api.HostConfig.PortBindings['3000/tcp'].some(p => p.HostPort === '3001' && p.HostIp === '127.0.0.1'))
const uuid = docker('exec', 'web1-chodocu-mysql-1', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names -e "SELECT @@server_uuid"').trim()
const password = process.env.D06_TEST_PASSWORD || crypto.randomBytes(24).toString('base64url')
assert(password.length >= 24)
let browser, server
try {
  const output = execFileSync('docker', ['exec', '-i', '-e', 'LOCAL_D06_TEST=true', '-e', `EXPECTED_LOCAL_DB_UUID=${uuid}`, 'web1-chodocu-api-1', 'node', 'tests/D06_XacNhanNhanHang/verify-local.js'], { input: JSON.stringify({ password }), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  const fixture = JSON.parse(output.trim()); assert(fixture.pass)
  console.log(`PASS local API/DB: auth, D03/D04, D06 concurrent/idempotent, B08 fallback=${fixture.fallbackRate}, rollback, B06 both lock directions, B07 lock compatibility. Completed=${fixture.completed}`)
  const require = createRequire(import.meta.url)
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
  browser = await chromium.launch({ headless: true })
  const dist = path.join(root, 'frontend/dist'); await fs.access(path.join(dist, 'index.html'))
  server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const proxy = http.request({ hostname: '127.0.0.1', port: 3001, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      proxy.on('error', () => { res.writeHead(502); res.end() }); req.pipe(proxy); return
    }
    try {
      const url = new URL(req.url, 'http://localhost'), asset = path.resolve(dist, '.' + decodeURIComponent(url.pathname))
      if (!asset.startsWith(dist + path.sep) && asset !== dist) { res.writeHead(403); res.end(); return }
      let target = asset
      try { if (!(await fs.stat(target)).isFile()) target = path.join(dist, 'index.html') } catch { target = path.join(dist, 'index.html') }
      res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream')
      res.end(await fs.readFile(target))
    } catch { res.writeHead(500); res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  page.on('dialog', dialog => dialog.accept())
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  let receiptWrites = 0, refundWrites = 0
  page.on('request', request => {
    if (request.method() === 'PATCH' && /\/received$/.test(request.url())) receiptWrites++
    if (request.method() === 'POST' && /\/refund-requests$/.test(request.url())) refundWrites++
  })
  const login = async (name, pw = password) => {
    await page.locator('#login-email').fill(fixture.accounts[name].email)
    await page.locator('#login-password').fill(pw)
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  }
  const receiptPath = `/orders/${fixture.browser}/received?source=d06#confirm`
  await page.goto(url + receiptPath)
  await page.waitForURL(current => current.pathname === '/login')
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), receiptPath)
  await login('buyer', 'wrong-password-local-test')
  await page.getByRole('alert').waitFor(); assert.equal(new URL(page.url()).pathname, '/login')
  assert.equal(await page.evaluate(() => sessionStorage.getItem('postLoginRedirect')), receiptPath)
  await login('buyer'); await page.waitForURL(current => current.pathname === `/orders/${fixture.browser}/received`)
  await page.getByRole('checkbox', { name: 'Tôi đã nhận được sản phẩm' }).waitFor()
  assert.equal(receiptWrites, 0); assert.equal(new URL(page.url()).hash, '#confirm')
  const button = page.getByRole('button', { name: 'Xác nhận hoàn tất', exact: true }); assert(await button.isDisabled())
  // D05 -> D06 bằng capability backend, không tự hoàn tất sau đăng nhập.
  await page.getByRole('link', { name: 'Theo dõi đơn hàng', exact: true }).click()
  await page.getByRole('link', { name: 'Xác nhận đã nhận hàng', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Tôi đã nhận được sản phẩm' }).check()
  assert(await button.isEnabled())
  const desktop = path.join(os.tmpdir(), 'web1-d06-desktop.png'); await page.screenshot({ path: desktop, fullPage: true })
  await button.click()
  await page.getByTestId('completed-at').waitFor()
  assert(await button.isDisabled()); assert.equal(receiptWrites, 1)
  await page.reload(); await page.getByTestId('completed-at').waitFor(); assert(await button.isDisabled()); assert.equal(receiptWrites, 1)
  await page.getByRole('link', { name: 'Theo dõi đơn hàng', exact: true }).click()
  await page.getByText('Hoàn tất lúc', { exact: true }).waitFor(); await page.reload(); await page.getByText('Hoàn tất lúc', { exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Xác nhận đã nhận hàng', exact: true }).count(), 0)
  console.log('PASS production UI: wrong/correct login, safe return, no auto PATCH, D05 -> D06 checkbox/complete -> D05 reload')
  await page.goto(url + `/orders/${fixture.problem}/received`)
  const problemLink = page.getByRole('link', { name: 'Sản phẩm có vấn đề / Yêu cầu hoàn tiền', exact: true }); await problemLink.waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  const mobile = path.join(os.tmpdir(), 'web1-d06-mobile.png'); await page.screenshot({ path: mobile, fullPage: true })
  await problemLink.click()
  await page.getByRole('heading', { name: `Yêu cầu hoàn tiền cho đơn #${fixture.problem}`, exact: true }).waitFor()
  await page.getByText('Đã chuyển đến biểu mẫu yêu cầu hoàn tiền.', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, `/orders/${fixture.problem}/refund`); assert.equal(receiptWrites, 1); assert.equal(refundWrites, 0)
  const check = await page.evaluate(async id => {
    const response = await fetch(`/api/v1/orders/${id}/tracking`, { headers: { authorization: `Bearer ${localStorage.getItem('accessToken')}` } }); return response.json()
  }, fixture.problem)
  assert.equal(check.data.orderStatus, 'DELIVERED'); assert.equal(check.data.refunds.length, 0)
  // 500/network không bị coi là 401 và không làm mất phiên.
  await page.route('**/received-preview', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'D06 simulated server error' }) }))
  await page.goto(url + `/orders/${fixture.problem}/received`); await page.getByRole('alert').waitFor()
  assert.equal(new URL(page.url()).pathname, `/orders/${fixture.problem}/received`)
  await page.unroute('**/received-preview'); await page.getByRole('button', { name: 'Tải lại trạng thái', exact: true }).click(); await problemLink.waitFor()
  await page.evaluate(() => localStorage.setItem('accessToken', 'invalid-token'))
  await page.reload(); await page.waitForURL(current => current.pathname === '/login')
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  await login('seller'); await page.waitForURL(current => current.pathname !== '/login'); await page.getByRole('alert').waitFor()
  assert.equal(new URL(page.url()).pathname, `/orders/${fixture.problem}/received`)
  assert.equal(receiptWrites, 1); assert.equal(refundWrites, 0); assert.deepEqual(errors, [])
  console.log(`PASS production mobile/B06 navigation no write/500 retry/expired JWT/403; screenshots: ${desktop}; ${mobile}`)
  // Kiểm tra frontend đang mở qua Vite, vẫn cùng backend source local:3001.
  const dev = await context.newPage(); dev.on('dialog', dialog => dialog.accept())
  await dev.goto(`http://localhost:5173/orders/${fixture.problem}/received`); await dev.waitForURL(current => current.pathname === '/login')
  await dev.locator('#login-email').fill(fixture.accounts.buyer.email); await dev.locator('#login-password').fill(password)
  await dev.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await dev.waitForURL(current => current.pathname === `/orders/${fixture.problem}/received`)
  await dev.getByRole('checkbox', { name: 'Tôi đã nhận được sản phẩm' }).waitFor()
  const health = await dev.request.get('http://localhost:5173/api/health'); assert.equal(health.status(), 200)
  console.log(`PASS Vite:5173 login/preview/health via local API:3001. Buyer=${fixture.accounts.buyer.email}; completed=${fixture.browser}; still DELIVERED=${fixture.problem}`)
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })
}
