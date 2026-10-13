import { api, getDevUserId } from '../../lib/api.js'
// JWT trước, rồi danh tính dev được chọn; chỉ fallback buyer demo khi chưa chọn.
const optionsFor = options => ({ ...options, d01Demo: !getDevUserId() })
export async function listBuyerOrders(params, options = {}) {
  const response = await api.get('/orders', { ...optionsFor(options), params })
  return response.data
}
export async function getOrderTracking(id, params = {}, options = {}) {
  const response = await api.get(`/orders/${id}/tracking`, { ...optionsFor(options), params })
  return response.data.data
}
