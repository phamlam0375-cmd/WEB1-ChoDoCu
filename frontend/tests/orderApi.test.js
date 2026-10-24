import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api } from '../src/lib/api.js'
import { createOrder, getOrderPreview } from '../src/services/orderApi.js'
import { estimateDeliveryFee } from '../src/services/deliveryFeeApi.js'

function mockResponse(t, data, inspect) {
  const adapter = api.defaults.adapter
  api.defaults.adapter = async (config) => {
    inspect(config)
    return { data, status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, config }
  }
  t.after(() => { api.defaults.adapter = adapter })
}

test('preview D01 dung endpoint v1, signal huy request va response data.data', async (t) => {
  const controller = new AbortController()
  const preview = {
    listing: { listingId: 42, price: 1234567, isAvailable: true, isOwnListing: false },
    buyer: { fullName: 'Nguoi mua', phone: '0901234567', address: 'Dia chi' },
    delivery: { available: false }, reservationMinutes: 15,
  }
  mockResponse(t, { success: true, data: preview }, (config) => {
    assert.equal(api.getUri(config), '/api/v1/orders/preview/42')
    assert.equal(config.method, 'get')
    assert.equal(config.signal, controller.signal)
  })
  assert.deepEqual(await getOrderPreview(42, { signal: controller.signal }), preview)
})

test('tao don giu nguyen payload va envelope message/data ma UI can', async (t) => {
  const payload = {
    listingId: 42, deliveryMethod: 'DELIVERY', receiverName: 'Nguoi mua',
    receiverPhone: '0901234567', receiverAddress: 'Dia chi', deliveryQuoteId: 'server-signed-quote',
  }
  const result = { success: true, message: 'Da giu mon', data: {
    orderId: 91, status: 'RESERVED', totalAmount: 1264567,
    deliveryMethod: 'DELIVERY', reservedUntil: '2026-10-07T08:15:00.000Z',
  } }
  mockResponse(t, result, (config) => {
    assert.equal(api.getUri(config), '/api/v1/orders')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.data), payload)
  })
  assert.deepEqual(await createOrder(payload), result)
})

test('diem tich hop D12 giu payload va bao gia server, khong tinh phi gia', async (t) => {
  const payload = { listingId: 42, receiverAddress: 'Dia chi' }
  const quote = { quoteId: 'server-signed-quote', amount: 30000, expiresAt: '2026-10-07T08:15:00.000Z' }
  mockResponse(t, { success: true, data: quote }, (config) => {
    assert.equal(api.getUri(config), '/api/v1/delivery-fees/estimate')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.data), payload)
  })
  assert.deepEqual(await estimateDeliveryFee(payload), quote)
})
