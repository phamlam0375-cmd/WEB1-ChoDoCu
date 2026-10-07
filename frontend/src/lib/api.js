import axios from 'axios'
import { getAccessToken } from './auth.js'

// Tài khoản thử nghiệm: tạm dùng cho tới khi A02 (đăng nhập) hoàn thành.
// Backend đọc header x-user-id (chỉ bật ngoài production).
const DEV_USER_KEY = 'choDoCu.devUserId'

export function getDevUserId() {
  try {
    return localStorage.getItem(DEV_USER_KEY) || ''
  } catch {
    return ''
  }
}

export function setDevUserId(userId) {
  try {
    if (userId) localStorage.setItem(DEV_USER_KEY, String(userId))
    else localStorage.removeItem(DEV_USER_KEY)
  } catch {
    // Trình duyệt chặn localStorage: bỏ qua, người dùng chọn lại tài khoản.
  }
}

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || '/api/v1',
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  // Login không được dùng token/header dev cũ; /me có Bearer mới được truyền rõ.
  if (config.skipSession) return config
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  else {
    const userId = getDevUserId()
    if (userId) config.headers['x-user-id'] = userId
  }
  return config
})

// API phải trả JSON; nhận trang HTML nghĩa là /api không được chuyển sang backend
// (ví dụ Vite chạy thiếu proxy) — báo lỗi rõ ràng thay vì coi như "chưa đăng nhập".
api.interceptors.response.use((response) => {
  const type = String(response.headers['content-type'] || '')
  if (response.config.responseType !== 'blob' && type.includes('text/html')) {
    const error = new Error('NOT_API')
    error.code = 'NOT_API'
    error.response = response
    return Promise.reject(error)
  }
  return response
})

// Lấy thông báo lỗi tiếng Việt từ backend ({ success: false, message }).
export function errorMessage(error, fallback = 'Có lỗi xảy ra, vui lòng thử lại') {
  if (error?.code === 'NOT_API') return 'Không gọi được API (máy chủ trả về trang web thay vì dữ liệu)'
  const data = error?.response?.data
  if (data?.errors?.length) return `${data.message}: ${data.errors.join(', ')}`
  if (data?.message) return data.message
  // Nginx/Vite báo 502–504 khi backend chưa chạy.
  if (error?.code === 'ERR_NETWORK' || [502, 503, 504].includes(error?.response?.status)) return 'Không kết nối được máy chủ'
  return fallback
}

// Tải file (CSV) từ API có kèm header xác thực.
export async function downloadFile(url, params) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const disposition = response.headers['content-disposition'] || ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] || 'export.csv'
  const href = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
  return {
    total: Number(response.headers['x-total-count'] || 0),
    exported: Number(response.headers['x-exported-count'] || 0),
  }
}
export default api;
