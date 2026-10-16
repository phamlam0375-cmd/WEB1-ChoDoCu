import { useDevAccount } from './useDevAccount'

// Dùng provider/phiên chung hiện có, không tạo kho token hoặc context thứ hai.
export function useAuth() {
  const { sessionStatus: status, sessionUser: user, sessionError: error, refreshSession: retry, logout, signedOutHere } = useDevAccount()
  return { status, user, error, retry, logout, signedOutHere }
}
