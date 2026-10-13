import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api, setDevUserId } from '../src/lib/api.js'
import { listBuyerOrders, getOrderTracking } from '../src/services/D05_TheoDoiDonHang/trackingApi.js'
import { formatDecimalMoney } from '../src/lib/format.js'
test('D05 GET correct routes/envelope/signal, demo only without explicit dev identity; decimal exact', async t => {
  const original = api.defaults.adapter, storage = globalThis.localStorage
  const map = new Map(); globalThis.localStorage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }
  t.after(() => { api.defaults.adapter = original; if (storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = storage })
  let count = 0
  const signal = new AbortController().signal
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'get'); assert.equal(config.signal, signal)
    if (count === 0) { assert.equal(config.url, '/orders'); assert.equal(config.d01Demo, true); assert.deepEqual(config.params, { page: 2, status: 'PAID' }) }
    else { assert.equal(config.url, '/orders/91/tracking'); assert.equal(config.d01Demo, false); assert.equal(config.headers['x-user-id'], '3') }
    count++
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, data: { orderId: 91 }, pagination: { page: 2 } } }
  }
  assert.equal((await listBuyerOrders({ page: 2, status: 'PAID' }, { signal })).pagination.page, 2)
  setDevUserId(3); assert.equal((await getOrderTracking(91, {}, { signal })).orderId, 91)
  assert.equal(formatDecimalMoney('9999999999999999.99'), '9.999.999.999.999.999,99 ₫')
  assert.equal(formatDecimalMoney('123456.10'), '123.456,10 ₫')
})
