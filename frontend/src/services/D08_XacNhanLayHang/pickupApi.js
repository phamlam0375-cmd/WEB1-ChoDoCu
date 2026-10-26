import { api } from '../../lib/api.js'
const encoded = value => encodeURIComponent(value)
export const getPickupPreview = async (deliveryId, { signal } = {}) => (await api.get(`/driver/deliveries/${encoded(deliveryId)}/pickup-preview`, { sessionOnly: true, signal })).data.data
export const getSellerPickup = async (orderId, { signal } = {}) => (await api.get(`/seller/orders/${encoded(orderId)}/pickup-code`, { sessionOnly: true, signal })).data.data
export const issuePickupCode = async orderId => (await api.post(`/seller/orders/${encoded(orderId)}/pickup-code`, { handoverConfirmed: true }, { sessionOnly: true })).data
export async function confirmPickup(deliveryId, { pickupCode, packageIntact, file }) {
  const body = new FormData()
  body.append('pickupCode', pickupCode)
  body.append('packageIntact', String(packageIntact))
  if (file) body.append('proof', file, file.name || 'pickup.png')
  return (await api.patch(`/driver/deliveries/${encoded(deliveryId)}/pickup`, body, { sessionOnly: true })).data
}
export const getPickupProof = async (orderId, deliveryId, { signal } = {}) => (await api.get(`/orders/${encoded(orderId)}/deliveries/${encoded(deliveryId)}/pickup-proof`, { sessionOnly: true, responseType: 'blob', signal })).data
export const INVALID_PICKUP_IMAGE = 'Chỉ chấp nhận JPG hoặc PNG tối đa 5 MB.'
export const validatePickupImage = file => file && (!['image/jpeg', 'image/png'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) ? INVALID_PICKUP_IMAGE : null
