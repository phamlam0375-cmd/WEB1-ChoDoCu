import assert from 'node:assert/strict'
export function createLinkChecks(child, fixture, origin, pages) {
  let sequence = 0
  const pending = new Map()
  child.on('message', message => {
    if (message?.type !== 'D_LINK_RESULT') return
    const item = pending.get(message.id)
    if (!item) return
    clearTimeout(item.timer); pending.delete(message.id)
    if (message.error) item.reject(new Error(`Read-only DB observation: ${message.error}`)); else item.resolve(message.data)
  })
  const read = input => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('DB observation timeout')) }, 10000)
    pending.set(id, { resolve, reject, timer }); child.send({ type: 'D_LINK_READ', id, listingId: fixture.listingId, ...input })
  })
  const api = async (page, path, options = {}) => {
    const token = await page.evaluate(() => localStorage.getItem('accessToken'))
    return page.request.fetch(origin + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
  }
  const checkpoint = async (label, ids, orderStatus, deliveryStatus = null) => {
    const s = await read(ids)
    assert.equal(s.order.OrderId, ids.orderId); assert.equal(s.order.Status, orderStatus)
    assert.equal(s.order.BuyerId, fixture.buyerId); assert.equal(s.order.SellerId, fixture.sellerId)
    assert.equal(s.order.ProductAmount, '100000.10'); assert.equal(s.order.DeliveryFee, '20000.20'); assert.equal(s.order.TotalAmount, '120000.30')
    assert.equal(s.listing.Status, orderStatus === 'COMPLETED' ? 'SOLD' : 'RESERVED')
    assert.equal(s.commissions.length, orderStatus === 'COMPLETED' ? 1 : 0)
    if (deliveryStatus) {
      assert.equal(s.deliveries.length, 1); assert.equal(s.deliveries[0].OrderId, ids.orderId)
      assert.equal(s.deliveries[0].Status, deliveryStatus); assert.equal(s.deliveries[0].DriverFee, s.order.DeliveryFee)
      if (deliveryStatus !== 'AVAILABLE') assert.equal(s.deliveries[0].DriverId, fixture.driverId)
    } else assert.equal(s.deliveries.length, 0)
    for (const [role, page] of Object.entries(pages)) {
      if (!page.url().startsWith(origin + '/')) continue
      if (!await page.evaluate(() => localStorage.getItem('accessToken'))) continue
      const response = await api(page, `/api/v1/orders/${ids.orderId}/tracking`)
      if (role === 'driver' && (!deliveryStatus || deliveryStatus === 'AVAILABLE')) { assert.equal(response.status(), 403); continue }
      assert.equal(response.status(), 200, `${role} tracking after ${label}`)
      const dto = (await response.json()).data
      assert.equal(dto.orderId, ids.orderId); assert.equal(dto.orderStatus, s.order.Status)
      assert.equal(dto.deliveryFee, s.order.DeliveryFee)
      if (role !== 'driver') { assert.equal(dto.productAmount, s.order.ProductAmount); assert.equal(dto.totalAmount, s.order.TotalAmount) }
      else { assert.equal(dto.productAmount, undefined); assert.equal(dto.totalAmount, undefined) }
      if (deliveryStatus) { assert.equal(dto.deliveries[0].deliveryId, s.deliveries[0].DeliveryId); assert.equal(dto.deliveries[0].status, deliveryStatus); assert.equal(dto.deliveries[0].driverFee, s.order.DeliveryFee) }
    }
    for (const h of s.histories) { assert.equal(h.OrderId, ids.orderId); if (h.DeliveryId) assert.equal(h.DeliveryId, s.deliveries[0].DeliveryId) }
    console.log(`PASS LINK ${label}: Listing#${fixture.listingId} Order#${ids.orderId} Delivery#${s.deliveries[0]?.DeliveryId || '-'} ${orderStatus}/${deliveryStatus || '-'}; UI/API/DB money + actors agree`)
    return s
  }
  return { read, api, checkpoint }
}

export async function enterDriverProfile({ driver, login, fixture, receiving, image, links }) {
  await login(driver, 'browserdriver', '/driver/deliveries')
  const unavailable = await links.api(driver, '/api/v1/driver/deliveries/available')
  assert.equal(unavailable.status(), 409); assert.equal((await links.read({})).driver.profile, null)
  await driver.getByRole('link', { name: 'Hồ sơ tài xế', exact: true }).click()
  const fields = { VehicleType: 'MOTORBIKE', VehiclePlate: '59A LINK', ServiceArea: fixture.area,
    ...(receiving === 'qr' ? {} : { BankName: 'TEST BANK', BankAccountNumber: '00001234', BankAccountHolder: 'TEST DRIVER' }) }
  for (const [key, value] of Object.entries(fields)) await driver.locator(`#driver-${key}`).fill(value)
  if (receiving === 'qr') await driver.getByLabel('Chọn QR nhận phí').setInputFiles({ name: 'receiving.png', mimeType: 'image/png', buffer: image })
  await driver.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await driver.getByTestId('driver-availability').getByText('OFFLINE', { exact: true }).waitFor()
  assert.equal((await links.api(driver, '/api/v1/driver/deliveries/available')).status(), 409)
  await driver.getByRole('button', { name: 'Bật nhận chuyến', exact: true }).click()
  await driver.getByTestId('driver-availability').getByText('AVAILABLE', { exact: true }).waitFor()
  await driver.reload(); await driver.getByTestId('driver-availability').getByText('AVAILABLE', { exact: true }).waitFor()
  const saved = await links.read({}); assert.equal(saved.driver.profile.availability, 'AVAILABLE'); assert.equal(saved.driver.active, 0)
  if (receiving === 'qr') { assert.equal(saved.driver.profile.qrValid, true); assert.equal(saved.driver.profile.bankReady, false) }
  else { assert.equal(saved.driver.profile.bankNumber, '00001234'); assert.equal(saved.driver.profile.bankReady, true) }
  console.log(`PASS LINK D11 -> D07: approved fixture driver saved ${receiving} via UI, OFFLINE -> AVAILABLE; missing profile/OFFLINE rejected by API`)
}
