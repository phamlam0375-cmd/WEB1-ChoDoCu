import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { listSellerPayments, getSellerPayment, decideSellerPayment } from '../src/services/D04_XacNhanNhanTien/confirmationApi.js'

test('D04 seller API giữ JWT/dev identity, không marker buyer; phân trang, phiên biên lai và action whitelist', async t => {
  const original = api.defaults.adapter
  t.after(() => { api.defaults.adapter = original })
  const signal = new AbortController().signal
  const version = 'a'.repeat(64)
  const data = { orderId: 91, reportVersion: version, productAmount: '9999999999999999.99' }
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.d01Demo, undefined)
    if (calls === 0) { assert.equal(config.url, '/seller/orders/payments'); assert.equal(config.params.page, 2); assert.equal(config.signal, signal) }
    if (calls === 1) { assert.equal(config.url, '/seller/orders/91/payment'); assert.equal(config.signal, signal) }
    if (calls === 2) {
      assert.equal(config.method, 'patch'); assert.equal(config.url, '/seller/orders/91/payment')
      assert.deepEqual(JSON.parse(config.data), { action: 'CONFIRM', reportVersion: version, note: 'checked' })
    }
    calls++
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, data, pagination: { page: 2 } } }
  }
  assert.equal((await listSellerPayments({ page: 2, limit: 20 }, { signal })).pagination.page, 2)
  assert.deepEqual(await getSellerPayment(91, { signal }), data)
  assert.equal((await decideSellerPayment(91, { action: 'CONFIRM', reportVersion: version, note: 'checked', sellerId: 3 })).data.productAmount, data.productAmount)
})
