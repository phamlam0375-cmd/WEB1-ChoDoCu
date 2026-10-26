import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getPickupPreview, getSellerPickup, issuePickupCode, confirmPickup, getPickupProof, validatePickupImage } from '../src/services/D08_XacNhanLayHang/pickupApi.js'
test('D08 API: JWT/session-only, đúng prefix, mã chỉ trong body, multipart không gửi URL/ID/phí', async t => {
  const previous = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const values = new Map([['choDoCu.devUserId', '2']]), storage = { getItem: key => values.get(key) || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = previous; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  let calls = 0
  const signal = new AbortController().signal
  api.defaults.adapter = async config => {
    assert.equal(config.sessionOnly, true); assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    if (calls++ === 0) { assert.equal(config.headers.Authorization, undefined); assert.equal(config.url, '/driver/deliveries/9/pickup-preview'); assert.equal(config.signal, signal) }
    else {
      assert.equal(config.headers.Authorization, 'Bearer actual-session')
      if (config.method === 'patch') {
        assert.equal(config.url, '/driver/deliveries/9/pickup'); assert.deepEqual([...config.data.keys()].sort(), ['packageIntact', 'pickupCode'])
        assert.ok(config.data.get('pickupCode').startsWith('0')); assert.equal(config.data.get('packageIntact'), 'true')
      } else if (config.method === 'post') {
        assert.equal(config.url, '/seller/orders/4/pickup-code'); assert.deepEqual(JSON.parse(config.data), { handoverConfirmed: true })
      } else if (config.responseType === 'blob') assert.equal(config.url, '/orders/4/deliveries/9/pickup-proof')
      else assert.equal(config.url, '/seller/orders/4/pickup-code')
    }
    return { config, status: 200, headers: { 'content-type': 'application/json' }, data: { data: { status: 'fixture' } } }
  }
  await getPickupPreview(9, { signal }); values.set('accessToken', 'actual-session')
  await getSellerPickup(4); await issuePickupCode(4); await confirmPickup(9, { pickupCode: '000042', packageIntact: true }); await getPickupProof(4, 9)
})
test('D08 ảnh tùy chọn, JPG/PNG giới hạn 5MB ở frontend; backend vẫn xác minh bytes', () => {
  assert.equal(validatePickupImage(null), null)
  assert.equal(validatePickupImage({ type: 'image/png', size: 5 * 1024 * 1024 }), null)
  assert.equal(validatePickupImage({ type: 'image/jpeg', size: 10 }), null)
  for (const file of [{ type: 'image/gif', size: 10 }, { type: 'image/png', size: 5 * 1024 * 1024 + 1 }, { type: 'image/png', size: 0 }]) assert.ok(validatePickupImage(file))
})
