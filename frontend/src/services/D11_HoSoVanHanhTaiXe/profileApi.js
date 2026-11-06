import { api } from '../../lib/api.js'
const config = { sessionOnly: true }
export const getDriverProfile = async signal => (await api.get('/driver/profile', { ...config, signal })).data.data
export const saveDriverProfile = async (profile, qr) => {
  let body = profile
  if (qr) { body = new FormData(); body.append('profile', JSON.stringify(profile)); body.append('qr', qr) }
  return (await api.patch('/driver/profile', body, config)).data
}
export const setDriverAvailability = async AvailabilityStatus => (await api.patch('/driver/availability', { AvailabilityStatus }, config)).data
export const getDriverQr = async (url, signal) => {
  // Chỉ dùng khóa QR do API hồ sơ trả về; không gửi Bearer tới URL tùy ý.
  if (!/^\/api\/v1\/driver\/profile\/qr\/[0-9a-f-]{36}\.(png|jpg)$/.test(url)) throw new Error('QR không hợp lệ')
  return (await api.get(`/driver/profile/qr/${url.split('/').pop()}`, { ...config, responseType: 'blob', signal })).data
}
