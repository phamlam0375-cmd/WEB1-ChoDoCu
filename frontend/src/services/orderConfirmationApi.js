import api from './apiClient'

export async function confirmOrder(orderId, payload) {
  const response = await api.patch(`/orders/${orderId}/confirm`, payload, { d01Demo: true })
  return response.data
}
