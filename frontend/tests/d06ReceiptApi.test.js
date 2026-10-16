import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { clearSession, getAccessToken } from '../src/lib/auth.js'
import { getReceiptPreview, confirmReceipt } from '../src/services/D06_XacNhanNhanHang/receiptApi.js'

test('D06 common client: session-only, không gửi ID/trạng thái client hoặc header demo/dev; giữ signal/envelope', async t => {
  const original = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']])
  const storage = { getItem: key => values.get(key) || null, removeItem: key => values.delete(key) }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = original; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const signal = new AbortController().signal, data = { orderId: 91, orderStatus: 'DELIVERED' }
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.d01Demo, undefined); assert.equal(config.signal, signal)
    assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (calls === 0) { assert.equal(config.url, '/orders/91/received-preview'); assert.equal(config.headers.Authorization, undefined) }
    else { assert.equal(config.method, 'patch'); assert.equal(config.url, '/orders/91/received'); assert.deepEqual(JSON.parse(config.data), { received: true }); assert.equal(config.headers.Authorization, 'Bearer real-session') }
    calls++
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, message: 'done', data } }
  }
  assert.deepEqual(await getReceiptPreview(91, { signal }), data)
  values.set('accessToken', 'real-session')
  assert.deepEqual((await confirmReceipt(91, true, { signal })).data, data)
  assert.equal(clearSession('stale-token'), false); assert.equal(getAccessToken(), 'real-session')
  values.set('token', 'old-session'); values.set('user', '{}'); assert.equal(clearSession('real-session'), true)
  assert.equal(values.size, 0); assert.equal(getAccessToken(), null)
})
