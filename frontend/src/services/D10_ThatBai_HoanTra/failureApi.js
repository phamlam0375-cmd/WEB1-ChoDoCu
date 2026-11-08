import { api } from '../../lib/api.js'
export const getFailurePreview = async (id, { signal } = {}) => (await api.get(`/driver/deliveries/${encodeURIComponent(id)}/failure-preview`, { sessionOnly: true, signal })).data.data
export async function updateFailure(id, payload, key, version) {
  const { action, note, reasonCode, scheduledAt, recipientName, handoverConfirmed } = payload
  const body = ['START_RETURN', 'CONFIRM_RETURN'].includes(action)
    ? { action, note, ...(action === 'CONFIRM_RETURN' ? { recipientName, handoverConfirmed } : {}) }
    : { action, note, ...(action === 'FAIL' ? { reasonCode } : {}), ...(action === 'SCHEDULE' ? { scheduledAt } : {}) }
  return (await api.patch(`/driver/deliveries/${encodeURIComponent(id)}/${['START_RETURN', 'CONFIRM_RETURN'].includes(action) ? 'return' : 'failure'}`, body,
    { sessionOnly: true, headers: { 'Idempotency-Key': key, 'If-Match': version } })).data
}
export function retryDateToISO(value) {
  const parts = value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/)
  if (!parts) throw new Error('Vui lòng chọn lịch giao lại.')
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
    .some((part, i) => part !== Number(parts[i + 1] || 0))) throw new Error('Lịch giao lại không hợp lệ trong múi giờ hiện tại.')
  return date.toISOString()
}
