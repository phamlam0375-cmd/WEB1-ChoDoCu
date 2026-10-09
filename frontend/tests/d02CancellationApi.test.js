import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api } from '../src/lib/api.js'
import { cancelOrder, getCancellationPreview } from '../src/services/D02_HuyDonHang/cancellationApi.js'

test('D02 GET/PATCH dùng đúng ID, opt-in demo cùng D01, signal và envelope chuẩn', async t => {
  const adapter = api.defaults.adapter
  t.after(() => { api.defaults.adapter = adapter })
  const signal = new AbortController().signal
  let step = 0
  const data = { orderId: 91, status: 'CANCELLED', cancelReason: 'Lý do thực' }
  api.defaults.adapter = async config => {
    assert.equal(config.d01Demo, true)
    if (step++ === 0) {
      assert.equal(api.getUri(config), '/api/v1/orders/91/cancellation-preview')
      assert.equal(config.method, 'get')
      assert.equal(config.signal, signal)
    } else {
      assert.equal(api.getUri(config), '/api/v1/orders/91/cancel')
      assert.equal(config.method, 'patch')
      assert.deepEqual(JSON.parse(config.data), { reason: 'Lý do thực' })
    }
    return { data: { success: true, message: 'Đơn #91 đã được hủy.', data }, status: 200, headers: { 'content-type': 'application/json' }, config }
  }
  assert.deepEqual(await getCancellationPreview(91, { signal }), data)
  assert.equal((await cancelOrder(91, 'Lý do thực')).message, 'Đơn #91 đã được hủy.')
})
