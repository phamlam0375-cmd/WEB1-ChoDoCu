import { createContext } from 'react'

// { userId, loggedIn, me, loading, error, switchUser(id), logout() } — xem DevAccountProvider.
export const DevAccountContext = createContext(null)
