import { Fragment, useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { clearSession, getAccessToken, rememberPostLoginUrl } from '../../lib/auth'
import { getDSession, sessionToken, subscribeDSession } from './dSessionStore'
const serverSnapshot = () => null
export default function DSessionBoundary({ children }) {
  const token = useSyncExternalStore(subscribeDSession, getDSession, serverSnapshot), location = useLocation()
  const [previous, setPrevious] = useState(token), [epoch, setEpoch] = useState(0)
  if (previous !== token) { setPrevious(token); setEpoch(n => n + 1) }
  const returnTo = location.pathname + location.search + location.hash
  useEffect(() => {
    if (!token) {
      const stored = getAccessToken({ sessionOnly: true })
      if (stored && !sessionToken(stored)) clearSession(stored)
      rememberPostLoginUrl(returnTo)
    }
  }, [token, returnTo])
  if (!token) return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ from: returnTo }} />
  return <Fragment key={epoch}>{children}</Fragment>
}
