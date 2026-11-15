import { api } from '../../lib/api.js'
// D05 không gửi danh tính dev hoặc fallback sang buyer demo.
const optionsFor = options => ({ ...options, sessionOnly: true })
export async function listBuyerOrders(params, options = {}) {
  const response = await api.get('/orders', { ...optionsFor(options), params })
  return response.data
}
export async function getOrderTracking(id, params = {}, options = {}) {
  const response = await api.get(`/orders/${id}/tracking`, { ...optionsFor(options), params })
  return response.data.data
}
