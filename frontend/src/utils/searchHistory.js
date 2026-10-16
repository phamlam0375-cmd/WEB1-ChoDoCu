import { normalizeSearchText } from './searchEngine.js'

const STORAGE_KEY = 'choDoCu.searchHistory'
const MAX_HISTORY_ITEMS = 8

function resolveStorage(storage) {
  if (storage) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function getSearchHistory(storage) {
  try {
    const stored = resolveStorage(storage)?.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed)
      ? parsed
        .filter((item) => typeof item === 'string' && normalizeSearchText(item))
        .slice(0, MAX_HISTORY_ITEMS)
      : []
  } catch {
    return []
  }
}

export function saveSearchHistory(query, storage) {
  const cleanQuery = String(query || '').trim()
  if (!normalizeSearchText(cleanQuery)) return getSearchHistory(storage)

  const normalizedQuery = normalizeSearchText(cleanQuery)
  const history = getSearchHistory(storage).filter(
    (item) => normalizeSearchText(item) !== normalizedQuery,
  )
  const nextHistory = [cleanQuery, ...history].slice(0, MAX_HISTORY_ITEMS)

  try {
    resolveStorage(storage)?.setItem(STORAGE_KEY, JSON.stringify(nextHistory))
  } catch {
    // Searches still work when browser storage is unavailable or full.
  }
  return nextHistory
}

export function clearSearchHistory(storage) {
  try {
    resolveStorage(storage)?.removeItem(STORAGE_KEY)
  } catch {
    // The history is optional and can be cleared again after storage is available.
  }
  return []
}
