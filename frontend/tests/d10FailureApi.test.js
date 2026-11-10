import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getFailurePreview, updateFailure, retryDateToISO } from '../src/services/D10_ThatBai_HoanTra/failureApi.js'
test('D10 session-only, đúng failure/return routes, khóa/version giữ nguyên và không gửi actor/count/proof', async t => {
  const oldAdapter = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']]), storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = oldAdapter; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const key = crypto.randomUUID(), version = '"d10-7-1-FAILED"', signal = new AbortController().signal
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (calls++ === 0) { assert.equal(config.url, '/driver/deliveries/7/failure-preview'); assert.equal(config.signal, signal); assert.equal(config.headers.Authorization, undefined) }
    else {
      assert.equal(config.headers.Authorization, 'Bearer actual-session'); assert.equal(config.headers['Idempotency-Key'], key); assert.equal(config.headers['If-Match'], version)
      const body = JSON.parse(config.data); assert.equal(body.DriverId, undefined); assert.equal(body.RetryCount, undefined); assert.equal(body.proofUrl, undefined)
      assert.equal(config.url, body.action === 'CONFIRM_RETURN' ? '/driver/deliveries/7/return' : '/driver/deliveries/7/failure')
    }
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { message: 'ok', data: {} } }
  }
  await getFailurePreview(7, { signal }); values.set('accessToken', 'actual-session')
  const payload = { action: 'SCHEDULE', note: 'ghi chú', scheduledAt: '2026-11-06T06:00:00Z', DriverId: 9, RetryCount: 99, proofUrl: '/fake' }
  await updateFailure(7, payload, key, version); await updateFailure(7, payload, key, version)
  await updateFailure(7, { action: 'CONFIRM_RETURN', recipientName: 'Seller', handoverConfirmed: true }, key, version)
})
test('D10 datetime-local được chuyển thành UTC ISO rõ timezone; không gửi raw chuỗi local', () => {
  assert.equal(retryDateToISO('2026-11-06T13:00:00'), new Date(2026, 10, 6, 13, 0, 0).toISOString())
  assert.throws(() => retryDateToISO(''))
  assert.throws(() => retryDateToISO('2026-02-30T13:00:00'))
})
