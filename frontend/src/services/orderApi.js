import { api } from '../lib/api.js'

export async function getOrderPreview(listingId, options = {}) {
  const response = await api.get(`/orders/preview/${listingId}`, { ...options, d01Demo: true })
  return response.data.data
}

export async function createOrder(payload) {
  const response = await api.post('/orders', payload, { d01Demo: true })
  return response.data
}
