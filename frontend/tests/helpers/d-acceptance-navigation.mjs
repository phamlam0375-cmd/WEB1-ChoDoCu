import assert from 'node:assert/strict'

// Mỗi bước nghiệp vụ dùng menu/nút thật; helper này không gọi API ghi dữ liệu.
export async function loginFromHome(page, { origin, email, password, destination }) {
  await page.goto(origin + '/')
  const logout = page.getByRole('button', { name: 'Đăng xuất', exact: true }).filter({ visible: true })
  if (await logout.count()) await logout.first().click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).first().click()
  await page.locator('#login-email').fill(email); await page.locator('#login-password').fill(password)
  await page.locator('.login-submit').click(); await page.waitForURL(origin + '/')
  if (destination === '/driver/deliveries') await page.getByRole('link', { name: 'Chuyến tài xế', exact: true }).first().click()
  else if (destination === '/seller/orders') {
    await page.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Cửa hàng của tôi', exact: true }).click()
  } else assert.equal(destination, '/')
}

export async function sellerQrFromStore(page, { sellerId, image }) {
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click()
  await page.locator('#qr-upload').setInputFiles({ name: 'seller-qr.png', mimeType: 'image/png', buffer: image })
  const saved = page.waitForResponse(r => r.url().endsWith(`/api/stores/${sellerId}`) && r.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click()
  const response = await saved; assert.equal(response.status(), 200)
  const qr = (await response.json()).data.QrImageUrl; assert.ok(qr)
  await page.getByRole('heading', { name: 'Chỉnh sửa thông tin cửa hàng', exact: true }).waitFor({ state: 'hidden' })
  await page.getByRole('link', { name: 'Xác nhận nhận tiền', exact: true }).click()
  await page.getByRole('heading', { name: 'Xác nhận nhận tiền', exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Đơn chờ chấp nhận', exact: true }).count(), 1, 'D04 thiếu đường đi tới C05; không được dán URL để vượt bước')
  await page.getByRole('link', { name: 'Đơn chờ chấp nhận', exact: true }).click()
  return qr
}

export async function buyerReopensOrder(page, orderId) {
  await page.getByRole('link', { name: 'Đơn mua của tôi', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Đơn mua của tôi', exact: true }).waitFor()
  await page.getByRole('link', { name: new RegExp(`^Đơn #${orderId} ·`) }).click()
  await page.getByRole('heading', { name: `Theo dõi đơn hàng #${orderId}`, exact: true }).waitFor()
}
