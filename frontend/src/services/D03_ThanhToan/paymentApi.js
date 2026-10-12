import { api } from '../../lib/api.js'

export async function getPaymentInfo(orderId, { signal } = {}) {
  const response = await api.get(`/orders/${orderId}/payment-info`, { signal, d01Demo: true })
  return response.data.data
}

export async function reportPayment(orderId, file, amount) {
  const body = new FormData()
  if (file) body.append('proof', file, file.name || 'receipt.png')
  if (amount !== undefined) body.append('amount', String(amount))
  // Để trình duyệt/Axios đặt boundary multipart; không gửi URL biên lai tùy ý.
  const response = await api.post(`/orders/${orderId}/payment-notice`, body, { d01Demo: true })
  return response.data
}
