import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getProgress, updateProgress, newProgressRequestId } from '../src/services/D09_CapNhatTienDoGiaoHang/progressApi.js'
test('D09 dùng lại preview D08; chỉ JWT thật, whitelist payload và Idempotency-Key giữ nguyên khi retry', async t => {
  const adapter = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']]), storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = adapter; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const signal = new AbortController().signal, requestId = newProgressRequestId()
  assert.notEqual(requestId, newProgressRequestId())
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (calls++ === 0) { assert.equal(config.url, '/driver/deliveries/7/pickup-preview'); assert.equal(config.signal, signal); assert.equal(config.headers.Authorization, undefined) }
    else {
      assert.equal(config.headers.Authorization, 'Bearer actual-session'); assert.equal(config.url, '/driver/deliveries/7/status')
      assert.equal(config.headers['Idempotency-Key'], requestId)
      assert.deepEqual(JSON.parse(config.data), { status: 'DELIVERING', note: 'ghi chú', action: 'NOTE' })
    }
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { message: 'ok', data: {} } }
  }
  await getProgress(7, { signal }); values.set('accessToken', 'actual-session')
  const body = { status: 'DELIVERING', note: 'ghi chú', action: 'NOTE', DriverId: 2, verified: true, ProofUrl: '/fake' }
  await updateProgress(7, body, requestId); await updateProgress(7, body, requestId)
})
