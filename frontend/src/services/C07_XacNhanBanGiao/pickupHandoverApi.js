import { api } from '../../lib/api.js'

export async function confirmPickupHandover(orderId, { signal } = {}) {
  const response = await api.post(`/seller/orders/${encodeURIComponent(orderId)}/pickup-handover`, {}, { sessionOnly: true, signal })
  return response.data
}
