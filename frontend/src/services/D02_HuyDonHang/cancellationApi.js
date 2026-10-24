import { api } from '../../lib/api.js'

export async function getCancellationPreview(orderId, options = {}) {
  const response = await api.get(`/orders/${orderId}/cancellation-preview`, { ...options, d01Demo: true })
  return response.data.data
}

export async function cancelOrder(orderId, reason) {
  const response = await api.patch(`/orders/${orderId}/cancel`, { reason }, { d01Demo: true })
  return response.data
}
