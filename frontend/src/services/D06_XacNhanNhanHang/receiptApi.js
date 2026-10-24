import { api } from '../../lib/api.js'

// D06 chỉ dùng phiên thật, không kế thừa header tài khoản thử nghiệm của D01.
export async function getReceiptPreview(orderId, { signal } = {}) {
  const response = await api.get(`/orders/${encodeURIComponent(orderId)}/received-preview`, { sessionOnly: true, signal })
  return response.data.data
}

export async function confirmReceipt(orderId, received, { signal } = {}) {
  const response = await api.patch(`/orders/${encodeURIComponent(orderId)}/received`, { received }, { sessionOnly: true, signal })
  return response.data
}
