const TOKEN_KEYS = ['accessToken', 'token']

export function getAccessToken() {
  try {
    for (const key of TOKEN_KEYS) {
      const value = window.localStorage.getItem(key)
      if (value) return value
    }
  } catch {
    // Trình duyệt chặn storage: vẫn có thể chuyển đến trang đăng nhập.
  }
  // Chỉ phục vụ kiểm thử cục bộ khi lập trình viên chủ động truyền biến Vite.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_ACCESS_TOKEN) {
    return import.meta.env.VITE_DEV_ACCESS_TOKEN
  }
  return null
}

export function rememberPostLoginUrl(url) {
  try {
    window.sessionStorage.setItem('postLoginRedirect', url)
  } catch {
    // returnTo trên URL/state vẫn giữ đường dẫn quay lại.
  }
}
