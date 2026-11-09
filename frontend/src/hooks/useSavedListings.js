import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY_PREFIX = 'cho-do-cu:saved-listings'

function getOwnerId() {
  try {
    const user = JSON.parse(window.localStorage.getItem('user') || 'null')
    const id = user?.UserId ?? user?.userId
    return id === undefined || id === null || String(id).trim() === '' ? 'guest' : String(id)
  } catch {
    return 'guest'
  }
}

function getStorageKey(ownerId) {
  return `${STORAGE_KEY_PREFIX}:${ownerId}`
}

function isValidListingId(id) {
  return (typeof id === 'string' && id.trim().length > 0)
    || (Number.isSafeInteger(id) && id > 0)
}

function readSavedIds(ownerId, rawValue) {
  try {
    const storedValue = rawValue === undefined
      ? window.localStorage.getItem(getStorageKey(ownerId))
      : rawValue
    const parsedValue = storedValue ? JSON.parse(storedValue) : []
    return new Set(Array.isArray(parsedValue) ? parsedValue.filter(isValidListingId) : [])
  } catch {
    return new Set()
  }
}

export default function useSavedListings() {
  const [savedIds, setSavedIds] = useState(() => readSavedIds(getOwnerId()))
  const savedIdsRef = useRef(savedIds)
  const ownerIdRef = useRef(getOwnerId())

  useEffect(() => {
    const syncSavedIds = (event) => {
      if (event.type === 'storage'
        && event.key !== getStorageKey(ownerIdRef.current)
        && event.key !== 'user'
        && event.key !== 'accessToken'
        && event.key !== 'token'
        && event.key !== null) return

      const ownerId = getOwnerId()
      ownerIdRef.current = ownerId
      const nextSavedIds = readSavedIds(
        ownerId,
        event.type === 'storage' && event.key === getStorageKey(ownerId) ? event.newValue : undefined,
      )
      savedIdsRef.current = nextSavedIds
      setSavedIds(nextSavedIds)
    }

    window.addEventListener('storage', syncSavedIds)
    window.addEventListener('auth-session-changed', syncSavedIds)
    return () => {
      window.removeEventListener('storage', syncSavedIds)
      window.removeEventListener('auth-session-changed', syncSavedIds)
    }
  }, [])

  const toggleSaved = useCallback((listingId) => {
    if (!isValidListingId(listingId)) {
      throw new Error('Mã sản phẩm không hợp lệ.')
    }

    const nextSavedIds = new Set(savedIdsRef.current)
    const willBeSaved = !nextSavedIds.has(listingId)
    if (willBeSaved) nextSavedIds.add(listingId)
    else nextSavedIds.delete(listingId)

    try {
      window.localStorage.setItem(getStorageKey(ownerIdRef.current), JSON.stringify([...nextSavedIds]))
    } catch (error) {
      throw new Error('Không thể cập nhật danh sách yêu thích.', { cause: error })
    }

    savedIdsRef.current = nextSavedIds
    setSavedIds(nextSavedIds)
    return willBeSaved
  }, [])

  return { savedIds, toggleSaved }
}
