import { useCallback, useMemo, useState } from 'react'
import { getDevUserId, setDevUserId } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { useApi } from '../hooks/useApi'
import { DevAccountContext } from './devAccountContext'

const SESSION_KEYS = ['accessToken', 'token', 'user']

// Tài khoản đang dùng cho các trang phân hệ B.
// - Đã đăng nhập thật (có token từ trang Đăng nhập): dùng tài khoản đó, ẩn ô tài khoản thử nghiệm.
// - Chưa đăng nhập: chọn tạm bằng mã người dùng (tài khoản thử nghiệm).
// Đổi tài khoản thì nội dung trang được tải lại.
export default function DevAccountProvider({ children }) {
  const [token, setToken] = useState(getAccessToken)
  const [devUserId, setDevUser] = useState(getDevUserId)
  const loggedIn = Boolean(token)
  const identity = loggedIn ? 'session' : devUserId
  const { data: me, loading, error } = useApi(identity ? '/me' : null, { u: identity })

  const switchUser = useCallback((id) => {
    setDevUserId(id)
    setDevUser(id ? String(id) : '')
  }, [])

  const logout = useCallback(() => {
    try {
      SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key))
    } catch {
      // Trình duyệt chặn localStorage: vẫn bỏ phiên trong trang hiện tại.
    }
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      userId: identity,
      loggedIn,
      me: identity && !loading && !error ? me : null,
      loading,
      error: identity ? error : null,
      switchUser,
      logout,
    }),
    [identity, loggedIn, me, loading, error, switchUser, logout],
  )

  return (
    <DevAccountContext.Provider value={value}>
      <div key={identity || 'guest'} className="contents">
        {children}
      </div>
    </DevAccountContext.Provider>
  )
}
