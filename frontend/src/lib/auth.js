const TOKEN_KEYS = ['accessToken', 'token']

export function getAccessToken() {
  for (const key of TOKEN_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value) return value
  }
  // Chỉ phục vụ kiểm thử cục bộ khi lập trình viên chủ động truyền biến Vite.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_ACCESS_TOKEN) {
    return import.meta.env.VITE_DEV_ACCESS_TOKEN
  }
  return null
}

export function rememberPostLoginUrl(url) {
  window.sessionStorage.setItem('postLoginRedirect', url)
}
