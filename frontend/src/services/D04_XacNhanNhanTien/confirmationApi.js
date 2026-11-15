import { api } from '../../lib/api.js'

// D04 chỉ dùng phiên đăng nhập thật của người bán.
export async function listSellerPayments(params, options = {}) {
  const response = await api.get('/seller/orders/payments', { ...options, sessionOnly: true, params })
  return response.data
}
export async function getSellerPayment(id, options = {}) {
  const response = await api.get(`/seller/orders/${id}/payment`, { ...options, sessionOnly: true })
  return response.data.data
}
export async function decideSellerPayment(id, { action, reportVersion, note }) {
  const response = await api.patch(`/seller/orders/${id}/payment`, { action, reportVersion, note }, { sessionOnly: true })
  return response.data
}
