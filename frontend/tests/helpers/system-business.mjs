import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { adminMenu } from './system-acceptance.mjs'

const waitResponse = (page, predicate) => { const promise = page.waitForResponse(predicate); promise.catch(() => {}); return promise }
const accountLink = async (page, label) => {
  await page.getByRole('link', { name: 'Đơn mua của tôi', exact: true }).filter({ visible: true }).first().click()
  await page.getByRole('navigation', { name: 'Tài khoản', exact: true }).getByRole('link', { name: label }).click()
}
const closeDialogs = async page => {
  for (let i = 0; i < 4; i++) {
    const close = page.getByRole('button', { name: 'Đóng', exact: true }).filter({ visible: true })
    if (!await close.count()) break
    try { await close.last().click({ timeout: 2000 }) } catch { if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape') }
  }
}

export async function runSystemBusiness({ audit, origin, prefix, fixture, buyer, seller, admin, orderId, pickupResult, image }) {
  const auth = async page => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('accessToken'))}` })
  const reportListing = await audit.read('listing', { listingId: fixture.reportListingId })
  await audit.check('C04', 'Sửa tin của mình, kiểm tra gửi duyệt lại', async () => {
    await seller.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first().click()
    await seller.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click()
    await seller.getByRole('menuitem', { name: 'Cửa hàng của tôi', exact: true }).click()
    await seller.getByRole('link', { name: 'Quản lý sản phẩm', exact: true }).click()
    if (fixture.auditCategoryTitle) {
      await seller.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click()
      await seller.locator('#CategoryId').waitFor()
      const categories = await seller.locator('#CategoryId option').allTextContents()
      if (!categories.includes(fixture.auditCategoryTitle)) await audit.bug('C03', 'Danh mục B03 mới không có trong form đăng tin', `B03 đã thêm/lưu ${fixture.auditCategoryTitle}; C03 #CategoryId chỉ có ${categories.length - 1} lựa chọn tĩnh, không tải danh mục đang ACTIVE.`)
      await seller.getByRole('button', { name: 'Hủy', exact: true }).click()
    }
    const row = seller.getByRole('heading', { name: reportListing.title, exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await row.getByRole('button', { name: 'Sửa', exact: true }).click()
    await seller.locator('#Description').fill(prefix + ' edited description')
    if (!await seller.locator('#Price').evaluate(input => input.checkValidity())) {
      await audit.bug('C04', 'Không sửa được tin có giá lẻ hợp lệ đã lưu', `Listing#${fixture.reportListingId}: Price=100000.10 từ DB, UpdateListingModal input step=1 gây stepMismatch ngay cả khi chỉ sửa Description; không có PATCH.`)
      await seller.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click()
      return 'UI chặn sửa tin cũ có giá lẻ; không thay giá/SQL để vượt validation'
    }
    const changed = waitResponse(seller, r => r.url().endsWith(`/seller/listing/${fixture.reportListingId}`) && r.request().method() === 'PATCH')
    await seller.getByRole('dialog').getByRole('button', { name: 'Cập nhật', exact: true }).click(); assert.equal((await changed).status(), 200)
    const saved = await audit.read('listing', { listingId: fixture.reportListingId })
    if (saved.status !== 'PENDING') await audit.bug('C04', 'Sửa nội dung quan trọng không gửi duyệt lại', `Listing#${saved.listingId} sửa Description qua UI, trạng thái vẫn ${saved.status}; sellerListing.controller.js updateListing.`)
    await seller.reload(); await seller.getByText(prefix + ' edited description', { exact: true }).waitFor()
    const legacy = await audit.read('listing', { listingId: fixture.legacyListingId })
    const legacyRow = seller.getByRole('heading', { name: legacy.title, exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await legacyRow.getByRole('button', { name: 'Sửa', exact: true }).click()
    if (!await seller.locator('#Price').evaluate(input => input.checkValidity())) await audit.bug('C04', 'Không sửa được tin cũ có giá lẻ', `Listing#${legacy.listingId}, Price=${legacy.price}; UpdateListingModal step=1 làm giá đang lưu không hợp lệ ngay cả khi không đổi giá.`)
    await seller.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click()
    return `Tin #${saved.listingId} sửa/reload lưu đúng; trạng thái sau sửa ${saved.status}`
  })
  await audit.check('C05', 'Đẩy tin VIP bằng credit sẵn có', async () => {
    const before = await audit.read('records')
    const row = seller.getByRole('heading', { name: reportListing.title, exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await row.getByRole('button', { name: 'Đẩy VIP', exact: true }).click()
    const promoted = waitResponse(seller, r => r.url().endsWith('/seller/listing/vip/bulk') && r.request().method() === 'POST')
    await seller.getByRole('button', { name: 'Xác nhận đẩy VIP', exact: true }).click()
    assert.equal((await promoted).status(), 201)
    const after = await audit.read('records'); assert.ok(Number(after.credits.Balance) < Number(before.credits.Balance))
    await seller.reload()
    assert.ok(after.promotions.some(item => item.ListingId === fixture.reportListingId && item.Status === 'ACTIVE'))
    if (!await row.getByRole('button', { name: 'Đang VIP', exact: true }).count()) await audit.bug('C05', 'Đẩy VIP thành công nhưng danh sách không hiện trạng thái VIP', `Listing#${fixture.reportListingId}: DB ACTIVE promotion, credit đã trừ; CrudListing.jsx gọi getPromotion(item) dù hàm nhận listingId, nên badge/nút sai sau reload.`)
    return 'VIP lưu thật, trừ credit đúng và reload giữ trạng thái; dùng số dư fixture có sẵn, không nạp/chuyển tiền thật'
  })
  await audit.check('C08', 'Chat hai vai trò, lưu lịch sử và quyền Socket.IO', async () => {
    await buyer.getByRole('link', { name: 'Trang chủ', exact: true }).filter({ visible: true }).first().click()
    await buyer.locator('article').filter({ hasText: reportListing.title }).locator('h3').click()
    const created = waitResponse(buyer, r => r.url().includes('/api/conversations/') && r.request().method() === 'POST')
    await buyer.locator('.product-chat-button').click()
    const response = await created; assert.equal(response.status(), 200)
    const conversationId = (await response.json()).data.ConversationId
    assert.equal((await buyer.request.get(`${origin}/api/conversations/${conversationId}/messages`)).status(), 401)
    const { io } = createRequire(import.meta.url)('socket.io-client')
    const outsider = io(origin, { transports: ['polling'], forceNew: true, reconnection: false })
    try {
      await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000); outsider.once('connect', () => { clearTimeout(timer); resolve() }); outsider.once('connect_error', e => { clearTimeout(timer); reject(e) }) })
      outsider.emit('join_conversation', conversationId)
      let leaked = false
      const marker = prefix + ' private chat test'
      outsider.on('new_message', message => { if (message.Content === marker) leaked = true })
      await buyer.getByPlaceholder('Nhập tin nhắn...', { exact: true }).fill(marker)
      const sent = waitResponse(buyer, r => r.url().endsWith(`/conversations/${conversationId}/messages`) && r.request().method() === 'POST')
      await buyer.getByRole('button', { name: 'Gửi', exact: true }).click(); assert.equal((await sent).status(), 201)
      await buyer.getByText(marker, { exact: true }).first().waitFor()
      await seller.getByRole('button', { name: 'Nhắn tin', exact: true }).click()
      await seller.getByText(marker, { exact: true }).first().click()
      await seller.getByPlaceholder('Nhập tin nhắn...', { exact: true }).waitFor()
      await seller.getByText(marker, { exact: true }).first().waitFor()
      const history = await seller.request.get(`${origin}/api/conversations/${conversationId}/messages`, { headers: await auth(seller) }); assert.equal(history.status(), 200)
      assert.ok(JSON.stringify(await history.json()).includes(marker))
      if (leaked) await audit.bug('C08', 'Socket.IO cho người không đăng nhập vào phòng chat', `Conversation#${conversationId}; socket không JWT join_conversation vẫn nhận new_message; src/server.js thiếu auth và kiểm tra participant. HTTP membership không bảo vệ kênh socket.`)
      return `Conversation#${conversationId}: buyer gửi/seller nhận/lịch sử DB có; kiểm tra socket ẩn danh=${leaked ? 'bị lộ' : 'không thấy lộ trong ca này'}`
    } finally { outsider.close(); await closeDialogs(buyer); await closeDialogs(seller) }
  })
  await audit.check('B04', 'Gửi báo cáo và chuyển xử lý', async () => {
    await accountLink(buyer, /Báo cáo của tôi/)
    await buyer.getByRole('link', { name: /Gửi báo cáo|Tạo báo cáo/ }).click()
    await buyer.getByRole('combobox', { name: /Đối tượng bị báo cáo/ }).selectOption('LISTING')
    await buyer.getByRole('textbox', { name: /^Mã / }).fill(String(fixture.reportListingId))
    await buyer.getByRole('combobox', { name: /^Lý do/ }).selectOption({ label: 'Khác' })
    await buyer.getByRole('textbox', { name: /^Mô tả/ }).fill(prefix + ' report test')
    const posted = waitResponse(buyer, r => r.url().endsWith('/api/v1/reports') && r.request().method() === 'POST')
    await buyer.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click(); const response = await posted; assert.equal(response.status(), 201)
    const reportId = (await response.json()).data.ReportId
    await adminMenu(admin, '/admin/reports')
    await admin.getByPlaceholder('Tiêu đề tin, tên hoặc mã', { exact: true }).fill(String(reportId))
    await admin.getByPlaceholder('Tiêu đề tin, tên hoặc mã', { exact: true }).press('Enter')
    await admin.getByRole('row').filter({ hasText: reportListing.title }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
    await admin.getByRole('button', { name: 'Chuyển xử lý', exact: true }).click()
    await admin.getByRole('dialog', { name: 'Chuyển xử lý báo cáo?', exact: true }).getByRole('button', { name: 'Chuyển xử lý', exact: true }).click()
    await admin.waitForURL(/\/admin\/listings/)
    await admin.getByRole('dialog', { name: `Xử lý báo cáo #${reportId}`, exact: true }).getByRole('button', { name: 'Ẩn tin', exact: true }).click()
    const decision = admin.getByRole('dialog', { name: 'Ẩn tin', exact: true })
    await decision.locator('textarea').fill('Nghiem thu an tin fixture vi pham, khong khoa seller')
    const resolved = waitResponse(admin, r => r.url().endsWith(`/admin/reports/${reportId}`) && r.request().method() === 'PATCH')
    await decision.getByRole('button', { name: 'Ẩn tin', exact: true }).click(); assert.equal((await resolved).status(), 200)
    await decision.waitFor({ state: 'hidden' })
    assert.equal((await audit.read('listing', { listingId: fixture.reportListingId })).status, 'SUSPENDED')
    assert.equal((await audit.read('records')).reports.find(row => row.ReportId === reportId).Status, 'RESOLVED')
    await closeDialogs(admin)
    await audit.record('B05', 'Đạt', 'UI + API/DB', `Tin chính duyệt ACTIVE; báo cáo #${reportId} chuyển kiểm duyệt -> ẩn tin SUSPENDED và RESOLVED lưu DB. Chưa thử gỡ/khóa.`)
    return `Báo cáo #${reportId} tạo từ buyer, quản trị tiếp nhận và tới B05 qua UI`
  })
  await audit.check('B06', 'Tạo yêu cầu hoàn tiền đúng đơn test', async () => {
    await buyer.getByRole('link', { name: 'Đơn mua của tôi', exact: true }).filter({ visible: true }).first().click()
    await buyer.getByRole('link', { name: new RegExp(`^Đơn #${pickupResult.orderId} ·`) }).click()
    await buyer.getByRole('link', { name: 'Yêu cầu hoàn tiền', exact: true }).click()
    await buyer.getByRole('combobox', { name: /^Lý do hoàn tiền/ }).selectOption({ label: 'Khác' })
    await buyer.getByRole('textbox', { name: /^Mô tả/ }).fill(prefix + ' refund test')
    const bank = buyer.getByRole('combobox', { name: /^Ngân hàng/ }); await bank.selectOption({ index: 1 })
    await buyer.getByRole('textbox', { name: /^Số tài khoản/ }).fill('000012345678')
    await buyer.getByRole('textbox', { name: /^Chủ tài khoản/ }).fill('TEST BUYER')
    const response = waitResponse(buyer, r => r.url().endsWith(`/orders/${pickupResult.orderId}/refund-requests`) && r.request().method() === 'POST')
    await buyer.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click(); assert.equal((await response).status(), 201)
    const records = await audit.read('records'); assert.ok(records.refunds.some(row => row.OrderId === pickupResult.orderId && row.Status === 'PENDING'))
    return `PICKUP Order#${pickupResult.orderId}: B06 PENDING thật; chưa phải hoàn tiền`
  })
  await audit.check('B07', 'Duyệt -> seller báo chuyển trả -> buyer xác nhận', async () => {
    const records = await audit.read('records'), refund = records.refunds.find(row => row.OrderId === pickupResult.orderId)
    assert.ok(refund)
    await adminMenu(admin, '/admin/refunds')
    await admin.getByPlaceholder('Mã đơn, tên người mua/bán', { exact: true }).fill(String(pickupResult.orderId)); await admin.getByPlaceholder('Mã đơn, tên người mua/bán', { exact: true }).press('Enter')
    await admin.getByRole('row').filter({ hasText: `#${pickupResult.orderId}` }).click()
    const detail = admin.getByRole('dialog', { name: /^Yêu cầu hoàn tiền / })
    await detail.getByRole('button', { name: 'Tiếp nhận', exact: true }).click()
    const reviewed = waitResponse(admin, r => r.url().endsWith(`/refund-requests/${refund.RefundRequestId}`) && r.request().method() === 'PATCH')
    await admin.getByRole('dialog', { name: 'Tiếp nhận', exact: true }).getByRole('button', { name: 'Tiếp nhận', exact: true }).click(); assert.equal((await reviewed).status(), 200)
    await detail.getByRole('button', { name: 'Chấp nhận hoàn tiền', exact: true }).click()
    const approved = waitResponse(admin, r => r.url().endsWith(`/refund-requests/${refund.RefundRequestId}`) && r.request().method() === 'PATCH')
    await admin.getByRole('dialog', { name: 'Chấp nhận hoàn tiền', exact: true }).getByRole('button', { name: 'Chấp nhận hoàn tiền', exact: true }).click(); assert.equal((await approved).status(), 200)
    await admin.getByRole('dialog', { name: 'Chấp nhận hoàn tiền', exact: true }).waitFor({ state: 'hidden' })
    await closeDialogs(admin)
    await accountLink(seller, 'Hoàn tiền')
    await seller.getByRole('button', { name: 'Tôi là người bán', exact: true }).click()
    await seller.getByRole('row').filter({ hasText: `#${pickupResult.orderId}` }).click()
    await seller.getByRole('button', { name: 'Báo đã chuyển trả', exact: true }).click()
    await seller.getByRole('textbox', { name: 'Mã giao dịch', exact: true }).fill('TEST' + Date.now())
    const transferred = waitResponse(seller, r => r.url().endsWith(`/refund-requests/${refund.RefundRequestId}`) && r.request().method() === 'PATCH')
    await seller.getByRole('dialog', { name: 'Báo đã chuyển trả', exact: true }).getByRole('button', { name: 'Báo đã chuyển trả', exact: true }).click(); assert.equal((await transferred).status(), 200)
    await seller.getByRole('dialog', { name: 'Báo đã chuyển trả', exact: true }).waitFor({ state: 'hidden' })
    await closeDialogs(seller)
    await accountLink(buyer, 'Hoàn tiền')
    await buyer.getByRole('row').filter({ hasText: `#${pickupResult.orderId}` }).click()
    await buyer.getByRole('button', { name: 'Đã nhận tiền', exact: true }).click()
    const completed = waitResponse(buyer, r => r.url().endsWith(`/refund-requests/${refund.RefundRequestId}`) && r.request().method() === 'PATCH')
    await buyer.getByRole('dialog', { name: 'Đã nhận tiền', exact: true }).getByRole('button', { name: 'Đã nhận tiền', exact: true }).click(); assert.equal((await completed).status(), 200)
    await buyer.getByRole('dialog', { name: 'Đã nhận tiền', exact: true }).waitFor({ state: 'hidden' })
    await closeDialogs(buyer)
    assert.equal((await audit.read('records')).refunds.find(row => row.RefundRequestId === refund.RefundRequestId).Status, 'COMPLETED')
    return `Refund#${refund.RefundRequestId} hoàn tất ghi nhận bằng UI ba vai trò; mã giao dịch test, không chuyển khoản thật`
  })
  await audit.check('B09', 'Người bán báo nộp phí và admin đối soát', async () => {
    await accountLink(seller, /Phí.*hoa hồng/)
    const row = seller.locator('li').filter({ hasText: `Đơn #${orderId} ·` })
    await row.getByRole('checkbox').check(); await seller.getByRole('button', { name: 'Nộp phí', exact: true }).click()
    await seller.getByRole('textbox', { name: /^Mã giao dịch/ }).fill('FT' + Date.now())
    const reported = waitResponse(seller, r => r.url().endsWith('/seller/fee-payments') && r.request().method() === 'POST')
    await seller.getByRole('button', { name: 'Báo đã nộp', exact: true }).click(); assert.equal((await reported).status(), 200)
    const records = await audit.read('records'), commission = records.commissions.find(item => item.OrderId === orderId); assert.equal(commission.Status, 'REPORTED')
    await adminMenu(admin, '/admin/fee-payments')
    await admin.locator('[role=tablist] button').filter({ hasText: 'Chờ xác nhận' }).click()
    await admin.getByRole('row').filter({ hasText: `#${orderId}` }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
    await admin.getByRole('button', { name: 'Xác nhận đã thu', exact: true }).click()
    const collected = waitResponse(admin, r => r.url().endsWith(`/admin/fee-payments/${commission.CommissionId}`) && r.request().method() === 'PATCH')
    await admin.getByRole('dialog', { name: /^Xác nhận đã thu —/ }).getByRole('button', { name: 'Xác nhận đã thu', exact: true }).click(); assert.equal((await collected).status(), 200)
    await admin.getByRole('dialog', { name: /^Xác nhận đã thu —/ }).waitFor({ state: 'hidden' })
    assert.equal((await audit.read('records')).commissions.find(item => item.OrderId === orderId).Status, 'PAID')
    await closeDialogs(admin)
    return `Commission Order#${orderId}: REPORTED -> PAID qua UI; chứng từ test, không chuyển tiền`
  })
  // Không để popup của một nhánh che điều hướng của các nhánh độc lập.
  await closeDialogs(buyer); await closeDialogs(seller); await closeDialogs(admin)
  await audit.save()
}
