import { api } from '../../lib/api.js'

export async function rejectOrder(orderId, reason) {
  const response = await api.patch(`/orders/${orderId}/reject`, { reason }, { d01Demo: true })
  return response.data
}
