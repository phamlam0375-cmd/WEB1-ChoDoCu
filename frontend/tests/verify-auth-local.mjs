// Opt-in integration/headless. No secrets are written to files or printed.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

if (process.env.LOCAL_AUTH_TEST !== 'true') throw new Error('Set LOCAL_AUTH_TEST=true to create isolated local fixtures')
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
const password = crypto.randomBytes(24).toString('base64url')
let browser, staticServer, page
try {
  const output = execFileSync('docker', ['exec', '-i', '-e', 'LOCAL_AUTH_TEST=true', '-e', `EXPECTED_LOCAL_DB_UUID=${uuid}`, 'web1-chodocu-api-1', 'node', 'tests/helpers/verify-auth-local.js'], { input: JSON.stringify({ password }), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  const fixture = JSON.parse(output.trim())
  assert(fixture.pass)
  console.log(`PASS actual local API: password login + D01/D02/D03 reject/resubmit/D04 confirm/D05, ownership/history/driver/B regression. Buyer=${fixture.accounts.buyer.id}; seller=${fixture.sellerId}; paid order=${fixture.paid}`)
  const require = createRequire(import.meta.url)
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
  browser = await chromium.launch({ headless: true })
  const dist = path.join(root, 'frontend/dist')
  await fs.access(path.join(dist, 'index.html'))
  staticServer = http.createServer(async (req, res) => {
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
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve))
  const productionUrl = `http://127.0.0.1:${staticServer.address().port}`
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  page = await context.newPage()
  page.on('dialog', dialog => dialog.accept())
  const login = async name => {
    await page.locator('#login-email').fill(fixture.accounts[name].email)
    await page.locator('#login-password').fill(password)
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.waitForURL(url => url.pathname !== '/login')
  }
  const track = id => page.getByRole('heading', { name: `Theo dõi đơn hàng #${id}`, exact: true }).waitFor()
  const logout = async () => {
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).first().click()
    await page.waitForURL(url => url.pathname === '/')
    assert.equal(await page.evaluate(() => ['accessToken', 'token', 'user', 'choDoCu.devUserId'].some(key => localStorage.getItem(key))), false)
  }
  await page.goto(productionUrl + `/orders/create/${fixture.listing}?source=auth-test`)
  await page.waitForURL(url => url.pathname === '/login')
  assert.equal(new URL(page.url()).searchParams.get('returnTo'), `/orders/create/${fixture.listing}?source=auth-test`)
  await login('buyer')
  await page.waitForURL(url => url.pathname === `/orders/create/${fixture.listing}`)
  await page.getByRole('heading', { name: 'Đặt hàng và giữ món' }).waitFor()
  assert.equal(await page.getByText('Đặt hàng thành công', { exact: true }).count(), 0)
  assert.equal(await page.getByText(/Chế độ test/).count(), 0)
  await page.locator('#receiver-name').fill('Local auth browser receiver')
  await page.locator('#receiver-phone').fill('0901234567')
  const created = page.waitForResponse(r => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST')
  await page.locator('form button[type=submit]').click()
  const response = await created; assert.equal(response.status(), 201)
  const createdId = (await response.json()).data.orderId
  await page.getByRole('button', { name: 'Theo dõi đơn hàng', exact: true }).click(); await track(createdId)
  console.log('PASS browser login/return + explicit D01 create + D05 tracking')
  // Khôi phục phiên chậm: không gọi API D trước khi /me hoàn thành, không nháy /login.
  let releaseMe, enteredMe
  const meEntered = new Promise(resolve => { enteredMe = resolve })
  const meReleased = new Promise(resolve => { releaseMe = resolve })
  let gated = false, dRequests = 0
  page.on('request', request => { if (gated && /\/api\/v1\/orders/.test(request.url())) dRequests++ })
  await page.route('**/api/v1/me', async route => { gated = true; enteredMe(); await meReleased; await route.continue() })
  await page.reload(); await meEntered
  assert.equal(new URL(page.url()).pathname, `/orders/${createdId}/tracking`); assert.equal(dRequests, 0)
  releaseMe(); await track(createdId); gated = false; await page.unroute('**/api/v1/me')
  await page.goto(productionUrl + `/orders/${fixture.cancelled}/cancel`)
  await page.getByRole('heading', { name: 'Hủy đơn hàng', exact: true }).waitFor()
  await page.goto(productionUrl + `/orders/${fixture.paid}/payment`)
  await page.getByRole('heading', { name: 'Thanh toán cho người bán', exact: true }).waitFor()
  console.log('PASS browser session restoration and D02/D03 pages')
  // 403 giữ trang và phiên, không nhầm với hết hạn.
  await logout(); await page.goto(productionUrl + `/orders/${fixture.paid}/tracking`); await login('other')
  await page.getByText('Bạn không có quyền theo dõi đơn hàng này.', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, `/orders/${fixture.paid}/tracking`)
  await page.goto(productionUrl + '/orders'); await page.getByText(/Chưa có đơn mua phù hợp/).waitFor()
  console.log('PASS browser logout/account switch + foreign-order 403 + buyer list isolation')
  // 401 thật từ backend xóa phiên, về login, lưu đúng order. Không tự replay thao tác.
  await page.evaluate(() => { localStorage.setItem('accessToken', 'invalid-test-session'); window.dispatchEvent(new Event('cho-do-cu:session-changed')) })
  await page.waitForURL(url => url.pathname === '/login'); assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  await login('seller'); await page.goto(productionUrl + `/seller/orders/${fixture.paid}/payment`)
  await page.getByText('Đã xác nhận nhận đủ tiền', { exact: true }).first().waitFor()
  assert.equal(await page.getByRole('spinbutton').count(), 0)
  await page.goto(productionUrl + '/seller/payments'); await page.getByRole('heading', { name: 'Xác nhận nhận tiền', exact: true }).waitFor()
  // Lỗi kiểm tra phiên do mạng/server không chuyển login và không xóa token.
  await page.route('**/api/v1/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Local network test' }) }))
  await page.reload(); await page.getByText('Local network test', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/seller/payments')
  assert(await page.evaluate(() => Boolean(localStorage.getItem('accessToken'))))
  await page.unroute('**/api/v1/me'); await page.getByRole('button', { name: /Thử lại/ }).click()
  await page.getByRole('heading', { name: 'Xác nhận nhận tiền', exact: true }).waitFor()
  await logout(); await context.close()
  // Dev Vite cũng yêu cầu đăng nhập dù localStorage còn tài khoản dev cũ.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await mobile.addInitScript(() => localStorage.setItem('choDoCu.devUserId', '1'))
  const devPage = await mobile.newPage(); devPage.on('dialog', dialog => dialog.accept())
  await devPage.goto('http://localhost:5173/orders'); await devPage.waitForURL(url => url.pathname === '/login')
  await devPage.locator('#login-email').fill(fixture.accounts.buyer.email); await devPage.locator('#login-password').fill(password)
  await devPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await devPage.waitForURL(url => url.pathname === '/orders')
  await devPage.getByRole('heading', { name: 'Đơn mua của tôi', exact: true }).waitFor()
  assert.equal(await devPage.getByRole('spinbutton').count(), 0)
  await mobile.close()
  console.log(`PASS production headless + Vite mobile: guest redirect/login/return, D01 explicit create #${createdId}, refresh/restore, owner 403, logout/other account no cache, invalid-token 401, seller D04, network retry, no demo UI.`)
} catch (error) {
  const message = String(error.stack || error.message).replaceAll(password, '[redacted]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted-token]')
  if (page) console.error('Browser path at failure: ' + new URL(page.url()).pathname)
  console.error(message); process.exitCode = 1
} finally {
  await browser?.close()
  if (staticServer) { staticServer.closeAllConnections(); await new Promise(resolve => staticServer.close(resolve)) }
}
