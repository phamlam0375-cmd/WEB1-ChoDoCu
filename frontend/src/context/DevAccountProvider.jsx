import { useCallback, useMemo, useState } from 'react'
import { getDevUserId, setDevUserId } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { useApi } from '../hooks/useApi'
import { DevAccountContext } from './devAccountContext'

const SESSION_KEYS = ['accessToken', 'token', 'user']

// Phiên thật dùng JWT và hồ sơ /me; chưa có phiên thì giữ bộ chọn tài khoản dev.
// D01/D02 demo được giới hạn tại API riêng, không cấp phiên cho phân hệ B/admin.
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
      SESSION_KEYS.forEach(key => window.localStorage.removeItem(key))
    } catch {
      // Trình duyệt chặn storage: vẫn bỏ phiên khỏi context hiện tại.
    }
    // Không tự kích hoạt lại danh tính dev cũ sau khi đăng xuất phiên thật.
    setDevUserId('')
    setDevUser('')
    setToken(null)
  }, [])

  const value = useMemo(
    () => {
      const currentUser = identity && !loading && !error ? me : null
      return {
        userId: currentUser?.UserId || identity,
        loggedIn,
        me: currentUser,
        loading,
        error: identity ? error : null,
        switchUser,
        logout,
      }
    },
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
