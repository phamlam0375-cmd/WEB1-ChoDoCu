import { api } from '../lib/api.js'

// Giữ đường dẫn /api/auth/login từ nhánh master, đi qua Vite/Nginx hoặc API URL
// đã cấu hình. Không gắn cứng localhost:5000 và không dùng header dev để login.
export async function loginWithPassword(email, password) {
  const baseURL = api.defaults.baseURL.replace(/\/v1\/?$/, '')
  const { data } = await api.post('/auth/login', { email, password }, { baseURL, skipSession: true })
  if (data?.success === false) throw new Error(data.message || 'Đăng nhập thất bại.')
  const accessToken = data?.accessToken || data?.token
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('API đăng nhập chưa trả phiên xác thực cho D01. Cần tích hợp token từ backend; không dùng tài khoản demo thay thế.')
  }
  // Dùng danh tính đã được backend xác nhận, không suy ra ID 2 hoặc tin user từ client.
  const me = await api.get('/me', {
    headers: { Authorization: `Bearer ${accessToken}` }, skipSession: true,
  })
  if (!Number.isSafeInteger(Number(me.data?.data?.UserId)) || Number(me.data.data.UserId) <= 0) {
    throw new Error('Backend không trả danh tính người dùng hợp lệ.')
  }
  return {
    accessToken,
    user: { ...data.user, ...me.data.data },
    message: data.message || 'Đăng nhập thành công!',
  }
}
