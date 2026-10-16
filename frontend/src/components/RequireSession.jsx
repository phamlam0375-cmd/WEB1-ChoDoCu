import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { rememberPostLoginUrl } from '../lib/auth'
import { ErrorState, Loading } from './admin/AdminUi'

export default function RequireSession() {
  const { status, error, retry, signedOutHere } = useAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  useEffect(() => { if (status === 'guest' && !signedOutHere) rememberPostLoginUrl(returnTo) }, [status, returnTo, signedOutHere])
  if (status === 'loading') return <Loading />
  if (status === 'error') return <ErrorState message={error || 'Chưa kiểm tra được phiên đăng nhập.'} onRetry={retry} />
  if (status === 'guest' && signedOutHere) return <Navigate to="/" replace />
  if (status === 'guest') return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ from: returnTo }} />
  return <Outlet />
}
