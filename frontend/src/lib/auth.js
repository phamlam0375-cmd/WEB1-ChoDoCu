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
  if (import.meta.env?.DEV && import.meta.env.VITE_DEV_ACCESS_TOKEN) {
    return import.meta.env.VITE_DEV_ACCESS_TOKEN
  }
  return null
}

const unsafePath = (value) => value.includes('\\') || [...value].some((char) => char.charCodeAt(0) <= 32)

function internalPath(value) {
  const path = typeof value === 'string' ? value
    : value && typeof value.pathname === 'string'
      ? `${value.pathname}${value.search || ''}${value.hash || ''}`
      : ''
  if (!path.startsWith('/') || path.startsWith('//') || unsafePath(path)) return null
  try {
    const url = new URL(path, 'https://internal.invalid')
    const decodedPath = decodeURIComponent(url.pathname)
    if (url.origin !== 'https://internal.invalid' || decodedPath.startsWith('//')
      || unsafePath(decodedPath)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function resolvePostLoginPath(queryReturnTo, stateFrom, storedReturnTo) {
  return [queryReturnTo, stateFrom, storedReturnTo].map(internalPath).find(Boolean) || '/'
}

export function completeLogin(session, { storage, redirectStorage, queryReturnTo, stateFrom, clearDevIdentity, navigate }) {
  if (!session?.accessToken || !session.user?.UserId) throw new Error('Phiên đăng nhập không hợp lệ.')
  const returnTo = resolvePostLoginPath(queryReturnTo, stateFrom, redirectStorage.getItem('postLoginRedirect'))
  // Phải lưu được phiên đã xác thực trước khi xóa đường dẫn quay lại.
  storage.setItem('user', JSON.stringify(session.user))
  storage.setItem('accessToken', session.accessToken)
  storage.removeItem('token')
  clearDevIdentity()
  redirectStorage.removeItem('postLoginRedirect')
  navigate(returnTo, { replace: true })
}

export function rememberPostLoginUrl(url) {
  try {
    window.sessionStorage.setItem('postLoginRedirect', url)
  } catch {
    // returnTo trên URL/state vẫn giữ đường dẫn quay lại.
  }
}
