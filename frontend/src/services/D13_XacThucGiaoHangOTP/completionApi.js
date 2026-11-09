import { api } from '../../lib/api.js'
export { validatePickupImage as validateCompletionImage } from '../D08_XacNhanLayHang/pickupApi.js'
const id = encodeURIComponent
const options = { sessionOnly: true }
export const getBuyerCode = async (orderId, signal) => (await api.get(`/orders/${id(orderId)}/delivery-code`, { ...options, signal })).data.data
export const issueDeliveryCode = async orderId => (await api.post(`/orders/${id(orderId)}/delivery-code`, {}, options)).data
export const getCompletionPreview = async (deliveryId, signal) => (await api.get(`/driver/deliveries/${id(deliveryId)}/complete-preview`, { ...options, signal })).data.data
export async function completeDelivery(deliveryId, intent, requestId) {
  let body = {}
  if (intent) {
    body = new FormData()
    for (const key of ['completionCode', 'codeSession', 'handoverConfirmed']) body.append(key, String(intent[key]))
    body.append('proof', intent.file, intent.file.name || 'handover.png')
  }
  return (await api.patch(`/driver/deliveries/${id(deliveryId)}/complete`, body, { ...options, headers: { 'Idempotency-Key': requestId } })).data
}
export const getCompletionProof = async (orderId, deliveryId, signal) => (await api.get(`/orders/${id(orderId)}/deliveries/${id(deliveryId)}/completion-proof`, { ...options, signal, responseType: 'blob' })).data
