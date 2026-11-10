import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getDriverProfile, saveDriverProfile, setDriverAvailability, getDriverQr } from '../src/services/D11_HoSoVanHanhTaiXe/profileApi.js'

test('D11 chỉ gửi JWT thật; giữ số 0/NULL, multipart đúng mục đích, không gửi Bearer tới URL QR ngoài', async t => {
  const previous = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']]), storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = previous; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const signal = new AbortController().signal, payload = { BankAccountNumber: '00001234', MaxDistanceKm: null }
  let calls = 0
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (calls === 0) { assert.equal(config.headers.Authorization, undefined); assert.equal(config.signal, signal) }
    else assert.equal(config.headers.Authorization, 'Bearer actual-session')
    if (calls === 1) assert.deepEqual(JSON.parse(config.data), payload)
    if (calls === 2) {
      assert.ok(config.data instanceof FormData); assert.deepEqual(JSON.parse(config.data.get('profile')), payload)
      assert.ok(config.data.get('qr') instanceof Blob); assert.equal(config.data.get('proof'), null)
    }
    if (calls === 3) { assert.equal(config.url, '/driver/availability'); assert.deepEqual(JSON.parse(config.data), { AvailabilityStatus: 'OFFLINE' }) }
    if (calls === 4) { assert.equal(config.responseType, 'blob'); assert.equal(config.url, '/driver/profile/qr/00000000-0000-0000-0000-000000000000.png') }
    calls++
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, data: { profile: null } } }
  }
  assert.equal((await getDriverProfile(signal)).profile, null)
  values.set('accessToken', 'actual-session')
  await saveDriverProfile(payload); await saveDriverProfile(payload, new Blob(['test bytes'], { type: 'image/png' })); await setDriverAvailability('OFFLINE')
  await getDriverQr('/api/v1/driver/profile/qr/00000000-0000-0000-0000-000000000000.png')
  for (const url of ['https://other.test/qr.png', '/api/v1/uploads/other.png', '/api/v1/driver/profile/qr/../../private.png']) await assert.rejects(getDriverQr(url))
  assert.equal(calls, 5, 'URL không hợp lệ phải bị từ chối trước khi gửi token')
})
