import { useContext } from 'react'
import { DevAccountContext } from '../context/devAccountContext'

export function useDevAccount() {
  const context = useContext(DevAccountContext)
  if (!context) throw new Error('useDevAccount phải nằm trong DevAccountProvider')
  return context
}
