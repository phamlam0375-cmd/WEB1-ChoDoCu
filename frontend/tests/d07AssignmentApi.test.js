import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getDriverStatus, getAvailableDeliveries, acceptDelivery } from '../src/services/D07_TaiXeNhanChuyen/assignmentApi.js'

test('D07 chỉ gửi phiên thật; giữ endpoint, decimal, phân trang và body nhận chuyến rỗng', async t => {
  const previous = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']])
  const storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = previous; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const signal = new AbortController().signal
  let count = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true)
    assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (count++ === 0) {
      assert.equal(config.url, '/driver/status'); assert.equal(config.headers.Authorization, undefined); assert.equal(config.signal, signal)
      return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { data: { policy: { allowed: false } } } }
    }
    assert.equal(config.headers.Authorization, 'Bearer actual-session')
    if (config.method === 'get') { assert.equal(config.url, '/driver/deliveries/available'); assert.deepEqual(config.params, { page: 2, limit: 12 }); assert.equal(config.signal, signal) }
    else { assert.equal(config.url, '/driver/deliveries/17/accept'); assert.deepEqual(JSON.parse(config.data), {}) }
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, data: { driverFee: '20000.01' } } }
  }
  assert.equal((await getDriverStatus(signal)).policy.allowed, false)
  values.set('accessToken', 'actual-session')
  assert.equal((await getAvailableDeliveries({ page: 2, limit: 12 }, signal)).data.driverFee, '20000.01')
  assert.equal((await acceptDelivery(17)).success, true)
})
