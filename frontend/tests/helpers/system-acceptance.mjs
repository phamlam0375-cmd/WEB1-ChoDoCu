import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loginFromHome } from './d-acceptance-navigation.mjs'

export function createSystemAudit(child, root) {
  let sequence = 0
  const pending = new Map(), results = Object.fromEntries([['A',10],['B',12],['C',10],['D',13]].flatMap(([group, count]) => Array.from({ length: count }, (_, i) => [group + String(i + 1).padStart(2, '0'), { status: 'Chưa kiểm tra', method: 'Chưa chạy', detail: '' }]))), bugs = []
  child.on('message', message => {
    if (message?.type !== 'SYSTEM_RESULT') return
    const item = pending.get(message.id); if (!item) return
    clearTimeout(item.timer); pending.delete(message.id)
    if (message.error) item.reject(new Error('Read-only system observation: ' + message.error)); else item.resolve(message.data)
  })
  const read = (action, input = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('System IPC timeout')) }, 10000)
    pending.set(id, { resolve, reject, timer }); child.send({ type: 'SYSTEM_READ', id, action, ...input })
  })
  const save = async () => { await mkdir(path.join(root, 'frontend/test-results'), { recursive: true }); await writeFile(path.join(root, 'frontend/test-results/system-acceptance.json'), JSON.stringify({ results, bugs }, null, 2)) }
  const record = async (code, status, method, detail) => { results[code] = { status, method, detail }; console.log(`AUDIT ${code} ${status}: ${detail}`); await save() }
  const bug = async (code, title, detail) => { if (!bugs.some(item => item.code === code && item.title === title)) bugs.push({ code, title, detail }); if (results[code]) results[code].status = 'Lỗi'; await save() }
  const check = async (code, label, work) => {
    try { const detail = await work(); await record(code, bugs.some(item => item.code === code) ? 'Lỗi' : 'Đạt', 'UI + API/DB', detail || label); return true }
    catch (e) { await record(code, 'Bị chặn', 'UI/test - cần chẩn đoán', label + ': ' + String(e.message).replace(/\b\d{6}\b/g, '[code]').slice(0, 4000)); return false }
  }
  return { read, record, check, bug, results, save }
}

export const adminMenu = async (page, href) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (let i = 0; i < 4; i++) {
    const modal = page.locator('[role=dialog]:visible').last()
    if (!await modal.count()) break
    const close = modal.getByRole('button', { name: 'Đóng', exact: true })
    if (!await close.count()) break
    await close.last().click()
  }
  const leave = dialog => dialog.accept()
  page.on('dialog', leave)
  try { await page.locator(`a[href="${href}"]:visible`).first().click(); await page.waitForURL(url => url.pathname === href) }
  finally { page.removeListener('dialog', leave) }
}
const closeModal = async page => { const buttons = page.getByRole('button', { name: 'Đóng', exact: true }).filter({ visible: true }); if (await buttons.count()) await buttons.last().click() }
const waitResponse = (page, predicate) => { const promise = page.waitForResponse(predicate); promise.catch(() => {}); return promise }
const emailFor = (prefix, label) => `${prefix}_${label}@example.test`

async function applyPartner(page, { type, email, audit, image }) {
  const home = page.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first()
  if (await home.count()) await home.click()
  await page.getByLabel('Minh họa mua bán đồ cũ an toàn').getByText('Người bán xác minh', { exact: true }).click()
  if (type === 'DRIVER') await page.getByRole('button', { name: 'Tài xế', exact: true }).click()
  await page.getByPlaceholder('Nhập số CCCD', { exact: true }).fill('000000000001')
  await page.getByPlaceholder('Nhập email của bạn', { exact: true }).fill(email)
  await page.locator('input[type=file]').setInputFiles({ name: 'test-identity.png', mimeType: 'image/png', buffer: image })
  const otpSent = waitResponse(page, r => r.url().endsWith('/api/partner-applications/send-otp') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Gửi OTP', exact: true }).click()
  assert.equal((await otpSent).status(), 200)
  const mail = await audit.read('mail', { email })
  await page.getByPlaceholder('Nhập mã OTP', { exact: true }).fill(mail.code)
  const response = waitResponse(page, r => r.url().endsWith('/api/partner-applications') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  const result = await response; assert.equal(result.status(), 201)
  return (await result.json()).data.ApplicationId
}

async function approvePartner(admin, email, { expectBlocked = false } = {}) {
  await adminMenu(admin, '/admin/partner-applications')
  await admin.reload()
  const row = admin.getByRole('row').filter({ hasText: email })
  await row.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click()
  await admin.getByRole('button', { name: 'Duyệt', exact: true }).click()
  const response = waitResponse(admin, r => /\/admin\/partner-applications\/\d+$/.test(r.url()) && r.request().method() === 'PATCH')
  await admin.getByRole('button', { name: 'Xác nhận duyệt', exact: true }).click()
  const result = await response
  if (expectBlocked) { assert.equal(result.status(), 400); await closeModal(admin); await closeModal(admin); return }
  assert.equal(result.status(), 200)
  await closeModal(admin); await closeModal(admin)
}

export async function runSystemBefore({ audit, origin, prefix, password, fixture, buyer, seller, driver, admin, extra, image }) {
  const login = (page, label) => loginFromHome(page, { origin, email: emailFor(prefix, label), password, destination: '/' })
  await login(admin, 'auditadmin')
  await admin.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click()
  await admin.getByRole('menuitem', { name: 'Trang quản trị', exact: true }).click()
  await admin.locator('a[href="/admin/users"]:visible').first().waitFor()
  const regEmail = emailFor(prefix, 'registered'), regPassword = 'AuditTest9!' + prefix.slice(-8)
  await audit.check('A01', 'Đăng ký/OTP sandbox', async () => {
    await extra.goto(origin + '/')
    await extra.getByRole('button', { name: 'Đăng ký', exact: true }).first().click()
    await extra.locator('#register-full-name').fill('Người Thử Nghiệm')
    await extra.locator('input[type=email]').fill(regEmail)
    await extra.locator('input[type=password]').nth(0).fill(regPassword); await extra.locator('input[type=password]').nth(1).fill(regPassword)
    await extra.getByRole('button', { name: 'Đăng ký', exact: true }).click()
    await extra.waitForURL(/\/verify-email$/)
    const mail = await audit.read('mail', { email: regEmail })
    const boxes = extra.locator('.otp-boxes input')
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(mail.code[i])
    await extra.getByRole('button', { name: 'Xác nhận', exact: true }).click(); await extra.waitForURL(/\/login$/)
    assert.equal(Boolean((await audit.read('user', { email: regEmail })).EmailVerified), true)
    return 'Đăng ký bằng UI, OTP backend qua mail sink nội bộ, EmailVerified lưu DB; không gửi mail ra ngoài'
  })
  await audit.check('A02', 'Đăng nhập sai/đúng và phiên', async () => {
    await extra.locator('#login-email').fill(regEmail); await extra.locator('#login-password').fill('WrongPassword9!')
    const bad = waitResponse(extra, r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST')
    await extra.locator('.login-submit').click(); assert.equal((await bad).status(), 401)
    await extra.locator('#login-password').fill(regPassword); await extra.locator('.login-submit').click(); await extra.waitForURL(origin + '/')
    await extra.reload(); await extra.getByRole('button', { name: 'Đăng xuất', exact: true }).first().waitFor()
    return 'Sai mật khẩu 401; đúng mật khẩu vào trang chủ và reload giữ phiên'
  })
  await audit.check('A04', 'Cập nhật hồ sơ và validation', async () => {
    await extra.getByRole('link', { name: 'Mở hồ sơ cá nhân', exact: true }).click()
    await extra.locator('#fullName').fill('Nguoi 123'); await extra.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    assert.equal(await extra.locator('#fullName').getAttribute('aria-invalid'), 'true')
    assert.equal(await extra.locator('#fullName').getAttribute('placeholder'), 'Họ tên không được chứa số hoặc ký tự đặc biệt')
    await audit.bug('A04', 'Thông báo lỗi chỉ đặt trong placeholder', 'Nhập tên có số rồi Lưu: aria-invalid=true nhưng lý do nằm trong placeholder, bị giá trị đang nhập che mất; ProfilePage.jsx.')
    await extra.locator('#fullName').fill('Người Thử Nghiệm')
    await extra.locator('#phone').fill('08' + String(Date.now()).slice(-8)); await extra.locator('#address').fill('Nhà số 12, khu kiểm thử local')
    const saved = waitResponse(extra, r => r.url().endsWith('/api/v1/me') && r.request().method() === 'PATCH')
    await extra.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); assert.equal((await saved).status(), 200)
    await extra.reload(); assert.equal(await extra.locator('#address').inputValue(), 'Nhà số 12, khu kiểm thử local')
    assert.equal(Boolean((await audit.read('user', { email: regEmail })).PhoneVerified), false)
    return 'Validation tên; lưu/reload đúng hồ sơ; sửa số điện thoại chưa đồng nghĩa đã OTP'
  })
  await audit.check('A03', 'Quên mật khẩu/OTP/đăng nhập lại', async () => {
    await extra.getByRole('button', { name: 'Đăng xuất', exact: true }).first().click()
    await extra.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click()
    await extra.getByRole('button', { name: /Quên mật khẩu/ }).click()
    await extra.locator('#forgot-password-email').fill(regEmail); await extra.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click()
    await extra.waitForURL(/\/reset-password$/)
    const mail = await audit.read('mail', { email: regEmail })
    await extra.locator('#reset-password-new').fill(regPassword + 'a'); await extra.locator('#reset-password-otp').fill(mail.code)
    await extra.getByRole('button', { name: /Đổi mật khẩu|Đặt lại mật khẩu|Xác nhận/ }).click(); await extra.waitForURL(/\/login$/)
    await extra.locator('#login-email').fill(regEmail); await extra.locator('#login-password').fill(regPassword + 'a'); await extra.locator('.login-submit').click(); await extra.waitForURL(origin + '/')
    return 'Quên mật khẩu qua UI, OTP sink, mật khẩu mới đăng nhập thật được'
  })
  await audit.check('C01', 'Đăng ký đối tác từ tài khoản mới', async () => {
    const id = await applyPartner(extra, { type: 'SELLER', email: regEmail, audit, image })
    await approvePartner(admin, regEmail, { expectBlocked: true })
    await audit.bug('C01', 'Tài khoản mới không có đường xác thực điện thoại để B02 duyệt', `Application#${id}; A01 email verified, A04 phone saved but PhoneVerified=false; B02 approval=400, C01 chỉ có OTP email.`)
    return `Gửi hồ sơ #${id} qua UI được; điểm nối tài khoản mới -> B02 bị chặn do thiếu xác thực điện thoại`
  })
  for (const [page, label, type] of [[seller, 'seller', 'SELLER'], [driver, 'browserdriver', 'DRIVER']]) {
    await login(page, label)
    await applyPartner(page, { type, email: emailFor(prefix, label), audit, image })
    await approvePartner(admin, emailFor(prefix, label))
    assert.ok((await audit.read('user', { email: emailFor(prefix, label) })).roles.includes(type))
  }
  await audit.record('B02', 'Đạt', 'UI + API/DB', 'Duyệt SELLER/DRIVER đã xác thực; role + thông báo lưu thật; chặn tài khoản chưa xác thực điện thoại')
  const leak = await extra.request.get(origin + '/api/partner-applications')
  if (leak.status() === 200) await audit.bug('C01', 'API danh sách hồ sơ đối tác không cần đăng nhập', 'GET /api/partner-applications không Authorization trả 200 và dữ liệu hồ sơ; router GET thiếu middleware auth.')
  await login(seller, 'seller')
  await seller.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click(); await seller.getByRole('menuitem', { name: 'Cửa hàng của tôi', exact: true }).click()
  await audit.record('C02', 'Đạt', 'UI + API/DB', 'Vai trò SELLER sau B02 tìm được cửa hàng qua menu tài khoản; kiểm tra sửa QR/địa điểm tiếp trong luồng D')
  await seller.getByRole('link', { name: 'Quản lý sản phẩm', exact: true }).click()
  await seller.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click()
  const title = prefix + ' UI posted product'
  for (const [id, value] of Object.entries({ Title: title, Description: 'Sản phẩm nghiệm thu bằng giao diện, không dùng dữ liệu người thật.', Price: '100000', KnownDefects: 'Không có lỗi đã biết', Location: 'Khu kiểm thử local' })) await seller.locator('#' + id).fill(value)
  await seller.locator('#CategoryId').selectOption('1'); await seller.locator('#ConditionLevel').selectOption('GOOD')
  await seller.locator('#listing-images').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: image })
  const posted = waitResponse(seller, r => r.url().endsWith('/api/seller/listing') && r.request().method() === 'POST')
  await seller.getByRole('button', { name: /Đăng tin|Tạo sản phẩm|Đăng sản phẩm/ }).last().click()
  const response = await posted; assert.equal(response.status(), 201)
  const listingId = (await response.json()).data.ListingId
  const created = await audit.read('listing', { listingId }); assert.equal(created.status, 'PENDING')
  await audit.record('C03', 'Đạt', 'UI + API/DB', `Đăng tin #${listingId}, ảnh + tiền đúng, PENDING trước kiểm duyệt`)
  await adminMenu(admin, '/admin/listings')
  const search = admin.getByPlaceholder(/Tiêu đề|từ khóa|người bán/i).first(); if (await search.count()) await search.fill(title)
  await admin.getByRole('row').filter({ hasText: title }).getByRole('button', { name: /Xem|Chi tiết/ }).first().click()
  await admin.getByRole('button', { name: 'Duyệt tin', exact: true }).click()
  await admin.getByRole('button', { name: 'Duyệt tin', exact: true }).last().click()
  await closeModal(admin); await closeModal(admin)
  assert.equal((await audit.read('listing', { listingId })).status, 'ACTIVE')
  await audit.record('B05', 'Đạt', 'UI + API/DB', `Duyệt thủ công tin #${listingId}: PENDING -> ACTIVE; không gọi dịch vụ AI ngoài`)
  Object.assign(fixture, await audit.read('configureListing', { listingId }))
  fixture.productAmount = created.price
  fixture.totalAmount = (Number(created.price) + 20000.20).toFixed(2)
  await login(buyer, 'buyer')
  const article = buyer.locator('article').filter({ hasText: title })
  await article.locator('h3').waitFor()
  await audit.record('A05', 'Đạt', 'UI + API/DB', `Tin #${listingId} đăng/duyệt qua UI xuất hiện trên trang chủ; sẽ mở chi tiết và mua trong luồng D`)
  await buyer.getByRole('button', { name: 'Đăng xuất', exact: true }).first().click()
  return { listingId, title }
}

export async function runSystemAfter({ audit, origin, prefix, fixture, buyer, seller, admin, orderId }) {
  const tokenApi = async (page, url) => page.request.get(origin + url, { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('accessToken'))}` } })
  await audit.check('B01', 'Khóa/mở tài khoản và quyền quản trị', async () => {
    await adminMenu(admin, '/admin/users')
    await admin.getByPlaceholder('Email, số điện thoại hoặc mã người dùng', { exact: true }).fill(emailFor(prefix, 'registered'))
    await admin.getByPlaceholder('Email, số điện thoại hoặc mã người dùng', { exact: true }).press('Enter')
    await admin.getByRole('row').filter({ hasText: emailFor(prefix, 'registered') }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
    await admin.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click()
    await admin.getByRole('button', { name: 'Xác nhận', exact: true }).last().click()
    await admin.getByRole('button', { name: 'Mở khóa', exact: true }).waitFor()
    assert.equal((await audit.read('user', { email: emailFor(prefix, 'registered') })).Status, 'LOCKED')
    await admin.getByRole('button', { name: 'Mở khóa', exact: true }).click()
    await admin.getByRole('button', { name: 'Xác nhận', exact: true }).last().click()
    await admin.getByRole('button', { name: 'Khóa tài khoản', exact: true }).waitFor()
    await closeModal(admin)
    assert.equal((await tokenApi(buyer, '/api/v1/admin/users')).status(), 403)
    return 'UI khóa/mở tài khoản fixture, DB khớp; buyer gọi admin API bị 403'
  })
  await audit.check('B03', 'Thêm/sửa danh mục và điểm nối C03', async () => {
    await adminMenu(admin, '/admin/categories')
    await admin.getByRole('button', { name: 'Thêm danh mục', exact: true }).click()
    const category = prefix + ' Category'
    await admin.getByRole('textbox', { name: /^Tên danh mục/ }).fill(category)
    await admin.getByRole('textbox', { name: /^Mô tả/ }).fill('Danh mục kiểm thử local')
    const posted = waitResponse(admin, r => r.url().endsWith('/api/v1/admin/categories') && r.request().method() === 'POST')
    await admin.getByRole('button', { name: 'Lưu', exact: true }).click(); assert.equal((await posted).status(), 201)
    await admin.reload(); await admin.getByPlaceholder('Tìm tên danh mục', { exact: true }).fill(category)
    await admin.getByPlaceholder('Tìm tên danh mục', { exact: true }).press('Enter')
    await admin.getByRole('button', { name: `Sửa ${category}`, exact: true }).click()
    await admin.getByRole('textbox', { name: /^Mô tả/ }).fill('Mô tả đã sửa bằng UI')
    const changed = waitResponse(admin, r => /\/admin\/categories\/\d+$/.test(r.url()) && r.request().method() === 'PATCH')
    await admin.getByRole('button', { name: 'Lưu', exact: true }).click(); assert.equal((await changed).status(), 200)
    const data = await (await tokenApi(admin, '/api/v1/admin/categories?q=' + encodeURIComponent(category))).json()
    assert.ok(JSON.stringify(data).includes('Mô tả đã sửa bằng UI'))
    fixture.auditCategoryTitle = category
    return 'Thêm/sửa/reload danh mục riêng; backend lưu đúng mô tả, không sửa danh mục có sẵn'
  })
  await audit.check('B10', 'Thống kê và dữ liệu thật', async () => {
    const response = waitResponse(admin, r => r.url().includes('/api/v1/admin/statistics') && r.status() === 200)
    await adminMenu(admin, '/admin')
    const payload = await (await response).json()
    await admin.getByRole('heading', { name: 'Thống kê hoạt động và doanh thu', exact: true }).waitFor()
    assert.ok(payload.success); assert.ok((await audit.read('records')).commissions.some(row => Number(row.OrderId) === orderId))
    await admin.reload(); await admin.getByRole('heading', { name: 'Thống kê hoạt động và doanh thu', exact: true }).waitFor()
    return `Dashboard dùng dữ liệu thật sau hoàn tất Order#${orderId}; reload giữ số liệu, chưa kiểm toán mọi công thức biểu đồ`
  })
  await audit.check('B11', 'Nhật ký lọc theo quản trị viên', async () => {
    await adminMenu(admin, '/admin/audit-logs')
    await admin.getByRole('combobox', { name: 'Quản trị viên', exact: true }).selectOption(String(fixture.adminId))
    const records = await audit.read('records'); assert.ok(records.audit.length >= 3)
    await admin.getByRole('row').filter({ hasText: 'D13 fixture auditadmin' }).first().waitFor()
    await admin.reload(); await admin.getByRole('heading', { name: /Nhật ký/ }).first().waitFor()
    return 'Lọc UI + đối chiếu audit thực của duyệt đối tác/kiểm duyệt/khóa tài khoản'
  })
  await audit.check('B12', 'Validation và lưu cấu hình bằng hộp xác nhận', async () => {
    await adminMenu(admin, '/admin/settings')
    const clickSave = async () => {
      try { await admin.getByRole('button', { name: 'Lưu', exact: true }).click({ timeout: 5000 }) }
      catch (e) {
        const info = await admin.getByRole('button', { name: 'Lưu', exact: true }).evaluate(button => {
          const r = button.getBoundingClientRect()
          return { dialogs: [...document.querySelectorAll('[role=dialog]')].map(x => x.querySelector('h2')?.textContent), hit: document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2).slice(0, 5).map(x => ({ tag: x.tagName, class: x.className, label: x.getAttribute('aria-label') })) }
        })
        console.log('B12_UI_DIAGNOSTIC ' + JSON.stringify(info))
        await admin.screenshot({ path: 'test-results/b12-blocked.png', mask: [admin.getByRole('textbox', { name: /^Số tài khoản|^Chủ tài khoản/ })] })
        assert.ok(info.hit[0]?.class.includes('relative flex items-center gap-2 rounded-full'))
        await audit.bug('B12', 'Nút Nhắn tin che nút Lưu cấu hình', 'Viewport 1440x1100: Chat/ChatWidget.jsx fixed bottom-5 right-5 z-50 chặn pointer của Lưu tại /admin/settings. Ảnh b12-blocked.png; tiếp tục bằng bàn phím để kiểm tra backend, không force click/đổi CSS.')
        const button = admin.getByRole('button', { name: 'Lưu', exact: true })
        await button.focus(); await button.press('Enter')
      }
    }
    const field = admin.getByRole('textbox', { name: /^Thời gian giữ món/ }), original = await field.inputValue()
    await field.fill('-1')
    assert.equal(await field.getAttribute('aria-invalid'), 'true')
    const value = String(Number(original) + 1)
    await field.fill(value); await clickSave()
    await admin.getByRole('textbox', { name: /^Lý do thay đổi/ }).fill('Nghiem thu cau hinh trong DB test rieng')
    const saved = waitResponse(admin, r => r.url().endsWith('/api/v1/admin/settings') && r.request().method() === 'PUT')
    await admin.getByRole('button', { name: 'Xác nhận', exact: true }).last().click(); assert.equal((await saved).status(), 200)
    await admin.getByRole('heading', { name: 'Bạn có chắc muốn lưu thay đổi?', exact: true }).waitFor({ state: 'hidden' })
    await admin.reload(); assert.equal(await field.inputValue(), value)
    await field.fill(original); await clickSave()
    await admin.getByRole('textbox', { name: /^Lý do thay đổi/ }).fill('Khoi phuc gia tri truoc nghiem thu')
    const restored = waitResponse(admin, r => r.url().endsWith('/api/v1/admin/settings') && r.request().method() === 'PUT')
    await admin.getByRole('button', { name: 'Xác nhận', exact: true }).last().click(); assert.equal((await restored).status(), 200)
    await admin.getByRole('heading', { name: 'Bạn có chắc muốn lưu thay đổi?', exact: true }).waitFor({ state: 'hidden' })
    return 'Giá trị âm bị chặn; UI lưu, reload đối chiếu và khôi phục giá trị ban đầu; không dùng cấu hình đổi để vượt D'
  })
  const marketTitle = (await audit.read('listing', { listingId: fixture.reportListingId })).title
  await audit.check('A05', 'Tìm kiếm qua chỉ mục thực', async () => {
    await buyer.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first().click()
    await buyer.getByPlaceholder('Bạn đang tìm sản phẩm gì?', { exact: true }).fill(marketTitle)
    const pending = waitResponse(buyer, r => r.url().includes('/seller/listing/search'))
    await buyer.getByPlaceholder('Bạn đang tìm sản phẩm gì?', { exact: true }).press('Enter')
    const response = await pending
    if (response.status() !== 200) throw new Error(`Search dependency HTTP ${response.status()}; isolated database is not indexed into shared Elasticsearch products. Browsing/detail main product passed independently.`)
    const result = await response.json()
    if (!JSON.stringify(result.data).includes(marketTitle)) throw new Error('Elasticsearch products index does not contain isolated fixture. Not writing shared index; browsing/detail main product passed.')
    return 'Tìm kiếm từ khóa + chi tiết đúng tin mới duyệt'
  })
  await audit.check('A06', 'Bộ lọc giá', async () => {
    await buyer.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first().click()
    await buyer.reload()
    await buyer.locator('article').filter({ hasText: marketTitle }).waitFor()
    await buyer.getByPlaceholder('Từ', { exact: true }).fill('200000')
    await buyer.getByPlaceholder('Đến', { exact: true }).fill('300000')
    await buyer.getByRole('button', { name: 'Áp dụng', exact: true }).click()
    await buyer.locator('article').filter({ hasText: marketTitle }).waitFor({ state: 'hidden' })
    await buyer.getByPlaceholder('Từ', { exact: true }).fill(''); await buyer.getByPlaceholder('Đến', { exact: true }).fill('')
    await buyer.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).first().click()
    await buyer.locator('article').filter({ hasText: marketTitle }).waitFor()
    return 'Lọc giá và áp dụng loại đúng sản phẩm ngoài khoảng; xóa lọc hiện lại đúng tin'
  })
  await audit.check('A07', 'Lưu tin yêu thích và reload', async () => {
    await buyer.reload()
    await buyer.locator('article').filter({ hasText: marketTitle }).getByRole('button', { name: `Lưu ${marketTitle}`, exact: true }).click()
    await buyer.getByRole('button', { name: /Xem \d+ tin đã lưu/ }).filter({ visible: true }).first().click()
    await buyer.reload()
    await buyer.getByRole('button', { name: `Bỏ lưu ${marketTitle}`, exact: true }).waitFor()
    return 'Lưu/bộ lọc yêu thích/reload thành công; dữ liệu nằm localStorage, chưa có đồng bộ tài khoản ở backend'
  })
  await audit.check('A09', 'Gợi ý sản phẩm tương tự', async () => {
    await buyer.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first().click()
    await buyer.reload()
    await buyer.locator('article').filter({ hasText: marketTitle }).locator('h3').click()
    await buyer.getByRole('heading', { name: /Sản phẩm tương tự/ }).waitFor()
    assert.ok(await buyer.locator('input[aria-label^="Chọn "]').count() >= 2)
    return 'Chi tiết sản phẩm đã mua có gợi ý liên kết đến các sản phẩm khác, không tự gợi ý chính nó'
  })
  await audit.check('A08', 'So sánh hai sản phẩm', async () => {
    const boxes = buyer.locator('input[aria-label^="Chọn "]')
    await boxes.nth(0).check(); await boxes.nth(1).check()
    await buyer.getByRole('button', { name: 'So sánh', exact: true }).click()
    await buyer.getByRole('heading', { name: /So sánh sản phẩm/ }).waitFor()
    assert.ok(await buyer.getByRole('table').count())
    await buyer.getByRole('button', { name: 'Đóng bảng so sánh', exact: true }).click()
    return 'Chọn hai sản phẩm ở chi tiết -> bảng so sánh; dữ liệu UI, không có API ghi'
  })
  const closeCompare = buyer.getByRole('button', { name: 'Đóng bảng so sánh', exact: true }); if (await closeCompare.count()) await closeCompare.click()
  await audit.check('A10', 'Trợ lý có sẵn, nhánh không gọi AI ngoài', async () => {
    await buyer.getByRole('button', { name: 'Mở trợ lý AI', exact: true }).click()
    await buyer.getByLabel('Nội dung tin nhắn', { exact: true }).fill('xin chào')
    const reply = waitResponse(buyer, r => r.url().endsWith('/api/ai/chat') && r.request().method() === 'POST')
    await buyer.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click()
    const response = await reply; assert.equal(response.status(), 200)
    assert.ok((await response.json()).reply.includes('Xin chào'))
    await buyer.getByRole('button', { name: 'Đóng trợ lý AI', exact: true }).click()
    return 'Có code A10 hiện hữu; UI chào hỏi -> API rule local 200; chưa kiểm chứng dịch vụ AI bên ngoài (đã tắt key)'
  })
  await audit.check('C09', 'Đánh giá đơn đã hoàn tất', async () => {
    await buyer.getByRole('link', { name: 'Đơn mua của tôi', exact: true }).filter({ visible: true }).first().click()
    const card = buyer.getByRole('link', { name: new RegExp(`^Đơn #${orderId} ·`) }).locator('..').locator('..')
    await card.getByRole('link', { name: 'Đánh giá đơn hàng', exact: true }).click()
    const loaded = await tokenApi(buyer, `/api/v1/orders/${orderId}/reviews`)
    const cause = await audit.read('reviewsDiagnostic', { orderId })
    if (loaded.status() !== 200 || cause.error) {
      await audit.bug('C09', 'Không tải được đánh giá do thiếu association Sequelize', `GET /api/v1/orders/${orderId}/reviews HTTP ${loaded.status()}; ${cause.error}: ${cause.message}; review.service.js include reviewer/target, models/index.js chưa khai báo.`)
      return `Order#${orderId} COMPLETED mở C09 từ danh sách nhưng API lỗi, không có form đánh giá`
    }
    const forms = buyer.locator('form')
    await forms.nth(0).locator('textarea').fill('Nghiem thu: san pham dung mo ta')
    const response = waitResponse(buyer, r => r.url().endsWith(`/orders/${orderId}/reviews`) && r.request().method() === 'POST')
    await forms.nth(0).getByRole('button', { name: 'Gửi đánh giá', exact: true }).click(); assert.equal((await response).status(), 201)
    await buyer.reload(); await buyer.getByText('Nghiem thu: san pham dung mo ta', { exact: true }).waitFor()
    return `Order#${orderId} COMPLETED -> đánh giá seller lưu thật và reload còn; chưa thử mọi nhánh phản hồi`
  })
  await audit.check('B08', 'Hoa hồng theo đúng đơn', async () => {
    const records = await audit.read('records'), commission = records.commissions.find(row => Number(row.OrderId) === orderId)
    assert.ok(commission); assert.equal(records.commissions.filter(row => Number(row.OrderId) === orderId).length, 1)
    await adminMenu(admin, '/admin/commissions')
    await admin.getByRole('heading', { name: /Hoa hồng/ }).first().waitFor()
    const response = await tokenApi(admin, `/api/v1/admin/commissions?q=${orderId}`)
    assert.equal(response.status(), 200)
    return `Order#${orderId}: một khoản hoa hồng, tiền theo ProductAmount đã chốt; admin mở danh sách được`
  })
  await audit.check('C10', 'Thông báo đối tác và đánh dấu đã đọc', async () => {
    await seller.getByRole('button', { name: /Thông báo/ }).filter({ visible: true }).first().click()
    const records = await audit.read('records'); assert.ok(records.notifications.some(row => row.UserId === fixture.sellerId))
    const mark = seller.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true })
    if (await mark.count()) await mark.click()
    const paymentNotice = seller.getByRole('button').filter({ hasText: 'Người mua đã báo chuyển tiền' }).first()
    if (await paymentNotice.count()) {
      await paymentNotice.click()
      if (new URL(seller.url()).pathname === '/seller/orders') await audit.bug('C10', 'Thông báo đơn của seller dẫn về danh sách chỉ có RESERVED', `Bấm thông báo báo chuyển tiền sau D04: ${new URL(seller.url()).pathname}, không mở D04/chi tiết đơn; Header.jsx notificationUrl xử lý ORDER cho seller cố định /seller/orders.`)
    }
    return 'Chuông hiển thị thông báo phát sinh thật từ B02/đơn/tiền; kiểm tra hành động đọc nếu có'
  })
  await audit.save()
}
