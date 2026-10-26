import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getPaymentInfo, reportPayment } from '../src/services/D03_ThanhToan/paymentApi.js'

// D03 GET/POST v1: demo scoped, signal, multipart file thật, tiền sản phẩm và envelope
test('D03 GET/POST v1: demo scoped, signal, multipart file thật, tiền sản phẩm và envelope', async t => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous })
  const info = { orderId: 91, qr: { imageUrl: null }, productAmount: '123456.10', paymentStatus: 'REPORTED' }
  const signal = new AbortController().signal
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.d01Demo, true)
    if (calls++ === 0) {
      assert.equal(api.getUri(config), '/api/v1/orders/91/payment-info'); assert.equal(config.signal, signal)
    } else {
      assert.equal(api.getUri(config), '/api/v1/orders/91/payment-notice'); assert.equal(config.method, 'post')
      assert.ok(config.data instanceof FormData); assert.equal(config.data.get('proof').name, 'receipt.png')
      assert.equal(config.data.get('amount'), '123456.10'); assert.equal(config.data.has('proofUrl'), false)
    }
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, message: 'Đã gửi thông báo chuyển khoản cho người bán.', data: info } }
  }
  assert.deepEqual(await getPaymentInfo(91, { signal }), info)
  const receipt = new Blob(['fixture'], { type: 'image/png' })
  Object.defineProperty(receipt, 'name', { value: 'receipt.png' })
  assert.equal((await reportPayment(91, receipt, info.productAmount)).data.paymentStatus, 'REPORTED')
})
