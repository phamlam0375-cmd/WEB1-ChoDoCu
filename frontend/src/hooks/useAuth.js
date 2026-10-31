import { useDevAccount } from './useDevAccount'

// Dùng provider/phiên chung hiện có, không tạo kho token hoặc context thứ hai.
export function useAuth() {
  const { userId, me: user, loading, error, logout } = useDevAccount()
  const status = loading ? 'loading' : error ? 'error' : userId ? 'authenticated' : 'guest'
  return { status, user, error, retry: () => window.location.reload(), logout, signedOutHere: false }
}
