import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { estimateDeliveryFee } from '../src/services/deliveryFeeApi.js'
import { addAmounts, quoteSelectionKey } from '../src/services/D12_UocTinhPhiGiaoHang/quoteState.js'
import { formatDecimalMoney } from '../src/lib/format.js'
test('D12 gọi một endpoint bằng JWT thật, giữ signal/decimal và không gửi dev/demo', async t => {
  const previous = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']]), storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = previous; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const payload = { listingId: 4, receiverAddress: 'House 1', deliveryArea: 'A', vehicleType: 'MOTORBIKE' }, signal = new AbortController().signal
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    assert.equal(config.signal, signal); assert.equal(config.url, '/delivery-fees/estimate'); assert.deepEqual(JSON.parse(config.data), payload)
    assert.equal(config.headers.Authorization, calls++ ? 'Bearer actual-session' : undefined)
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, data: { amount: '20000.20', estimatedMinutes: null } } }
  }
  await estimateDeliveryFee(payload, { signal }); values.set('accessToken', 'actual-session')
  assert.deepEqual(await estimateDeliveryFee(payload, { signal }), { amount: '20000.20', estimatedMinutes: null })
})
test('D12 cộng/hiển thị tiền chính xác và đổi bất kỳ điều kiện báo giá đều đổi selection key', () => {
  assert.equal(addAmounts('0.10', '0.20'), '0.30'); assert.equal(addAmounts('9999999999999999.98', '0.01'), '9999999999999999.99')
  assert.equal(formatDecimalMoney('120000.30'), '120.000,30 ₫'); assert.equal(formatDecimalMoney(null), '—')
  for (const value of ['-1', 'NaN', '1.001']) assert.throws(() => addAmounts(value, '0'))
  const form = { deliveryMethod: 'DELIVERY', receiverAddress: 'House 1', deliveryArea: 'A', vehicleType: 'MOTORBIKE' }, key = quoteSelectionKey(1, form)
  for (const [field, value] of [['deliveryMethod', 'PICKUP'], ['receiverAddress', 'House 2'], ['deliveryArea', 'B'], ['vehicleType', 'TRUCK']]) assert.notEqual(quoteSelectionKey(1, { ...form, [field]: value }), key)
  assert.notEqual(quoteSelectionKey(2, form), key)
})
