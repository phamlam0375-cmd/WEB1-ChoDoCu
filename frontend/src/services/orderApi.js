import { api } from '../lib/api.js'

export async function getOrderPreview(listingId, options = {}) {
  const response = await api.get(`/orders/preview/${listingId}`, { ...options, sessionOnly: true })
  return response.data.data
}

export async function createOrder(payload, requestId) {
  const response = await api.post('/orders', payload, { sessionOnly: true, ...(requestId ? { headers: { 'Idempotency-Key': requestId } } : {}) })
  return response.data
}
