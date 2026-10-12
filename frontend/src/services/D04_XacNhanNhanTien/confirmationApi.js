import { api } from '../../lib/api.js'

// Không gắn d01Demo: đây là danh tính người bán JWT/dev được chọn riêng.
export async function listSellerPayments(params, options = {}) {
  const response = await api.get('/seller/orders/payments', { ...options, params })
  return response.data
}
export async function getSellerPayment(id, options = {}) {
  const response = await api.get(`/seller/orders/${id}/payment`, options)
  return response.data.data
}
export async function decideSellerPayment(id, { action, reportVersion, note }) {
  const response = await api.patch(`/seller/orders/${id}/payment`, { action, reportVersion, note })
  return response.data
}
