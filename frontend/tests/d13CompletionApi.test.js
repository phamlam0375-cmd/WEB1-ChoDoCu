import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/lib/api.js'
import { getBuyerCode, issueDeliveryCode, getCompletionPreview, completeDelivery, getCompletionProof } from '../src/services/D13_XacThucGiaoHangOTP/completionApi.js'
test('D13 API uses real JWT, distinct OrderId/DeliveryId, no implicit issue; multipart preserves 0 and strict checkbox', async t => {
  const old = api.defaults.adapter, oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  const storage = { getItem: key => ({ accessToken: 'actual-session', 'choDoCu.devUserId': '2' })[key] || null }
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage
  t.after(() => { api.defaults.adapter = old; globalThis.window = oldWindow; globalThis.localStorage = oldStorage })
  const calls = [], signal = new AbortController().signal, key = 'ba516c74-9fde-48f5-9fee-2d55c005ba3a'
  api.defaults.adapter = async config => {
    calls.push(config)
    assert.equal(config.sessionOnly, true); assert.equal(config.headers.Authorization, 'Bearer actual-session')
    assert.equal(config.headers['x-user-id'], undefined); assert.equal(config.headers['x-d01-demo'], undefined)
    return { config, status: 200, headers: {}, data: { success: true, data: { orderId: 11, deliveryId: 22 } } }
  }
  await getBuyerCode(11, signal); assert.equal(calls[0].method, 'get'); assert.equal(calls[0].url, '/orders/11/delivery-code'); assert.equal(calls[0].signal, signal)
  await issueDeliveryCode(11); assert.equal(calls[1].method, 'post'); assert.equal(calls[1].data, '{}')
  await getCompletionPreview(22, signal); assert.equal(calls[2].url, '/driver/deliveries/22/complete-preview')
  const file = new File(['proof'], 'handover.png', { type: 'image/png' })
  await completeDelivery(22, { completionCode: '001234', codeSession: key, handoverConfirmed: false, file }, key)
  const request = calls[3]; assert.equal(request.url, '/driver/deliveries/22/complete'); assert.equal(request.headers['Idempotency-Key'], key)
  assert.equal(request.data.get('completionCode'), '001234'); assert.equal(request.data.get('handoverConfirmed'), 'false'); assert.equal(request.data.get('proof').name, 'handover.png')
  await completeDelivery(22, null, key); assert.equal(calls[4].headers['Idempotency-Key'], key); assert.equal(calls[4].data, '{}')
  await getCompletionProof(11, 22, signal); assert.equal(calls[5].responseType, 'blob'); assert.equal(calls[5].url, '/orders/11/deliveries/22/completion-proof')
})
