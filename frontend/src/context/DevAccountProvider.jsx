import { useCallback, useMemo, useState } from 'react'
import { getDevUserId, setDevUserId } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { useApi } from '../hooks/useApi'
import { DevAccountContext } from './devAccountContext'

// Tài khoản đang dùng cho các trang phân hệ B. Tạm thời chọn bằng mã người dùng
// cho tới khi có đăng nhập thật (A02); đổi tài khoản thì nội dung trang được tải lại.
export default function DevAccountProvider({ children }) {
  const [userId, setUserId] = useState(getDevUserId)
  const signedIn = Boolean(getAccessToken())
  const { data: me, loading, error } = useApi(signedIn || userId ? '/me' : null, { u: userId })

  const switchUser = useCallback((id) => {
    setDevUserId(id)
    setUserId(id ? String(id) : '')
  }, [])

  const value = useMemo(
    () => ({ userId: me?.UserId || userId, me: (signedIn || userId) && !loading && !error ? me : null, loading, error: signedIn || userId ? error : null, switchUser }),
    [userId, me, loading, error, switchUser, signedIn],
  )

  return (
    <DevAccountContext.Provider value={value}>
      <div key={userId || 'guest'} className="contents">
        {children}
      </div>
    </DevAccountContext.Provider>
  )
}
