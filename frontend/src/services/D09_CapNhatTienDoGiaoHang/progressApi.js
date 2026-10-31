import { api } from '../../lib/api.js'
import { getPickupPreview } from '../D08_XacNhanLayHang/pickupApi.js'

// Tái sử dụng chi tiết chuyến đã phân quyền của D08, không thêm GET song song.
export const getProgress = getPickupPreview
export const newProgressRequestId = () => globalThis.crypto.randomUUID()
export async function updateProgress(deliveryId, { status, note, action }, requestId) {
  return (await api.patch(`/driver/deliveries/${encodeURIComponent(deliveryId)}/status`, { status, note, action },
    { sessionOnly: true, headers: { 'Idempotency-Key': requestId } })).data
}
