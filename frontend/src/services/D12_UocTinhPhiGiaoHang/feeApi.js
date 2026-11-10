import { api } from '../../lib/api.js'
import legacyApi from '../apiClient.js'
export async function estimateDeliveryFee(payload, { signal } = {}) {
  const response = await api.post('/delivery-fees/estimate', payload, { sessionOnly: true, signal })
  return response.data.data
}
export const prepareDelivery = async id => (await legacyApi.post(`/seller/orders/${encodeURIComponent(id)}/preparation`, {}, { sessionOnly: true })).data
