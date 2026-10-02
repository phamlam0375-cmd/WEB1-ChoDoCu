import { api } from '../lib/api'

export async function getOrderPreview(listingId, options = {}) {
  const response = await api.get(`/orders/preview/${listingId}`, options)
  return response.data.data
}

export async function createOrder(payload) {
  const response = await api.post('/orders', payload)
  return response.data
}
