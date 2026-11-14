import { getAccessToken } from '../../lib/auth.js'
// Chỉ dùng để bỏ dữ liệu UI cũ, quyền vẫn do JWT/backend quyết định.
export function sessionToken(token, now = Date.now()) {
  if (!token) return null
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const exp = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '='))).exp
    if (Number.isFinite(exp) && exp * 1000 <= now) return null
  } catch { /* Token không đọc được sẽ được backend từ chối; không cấp quyền từ payload. */ }
  return token
}
export const getDSession = () => sessionToken(getAccessToken({ sessionOnly: true }))
export function subscribeDSession(notify) {
  window.addEventListener('storage', notify)
  window.addEventListener('auth-session-changed', notify)
  window.addEventListener('focus', notify)
  // Fallback cho thời điểm JWT hết hạn và nút logout cũ chưa phát sự kiện; không gọi API/realtime.
  const timer = window.setInterval(notify, 1000)
  return () => {
    window.removeEventListener('storage', notify); window.removeEventListener('auth-session-changed', notify); window.removeEventListener('focus', notify)
    window.clearInterval(timer)
  }
}
