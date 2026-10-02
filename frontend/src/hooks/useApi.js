import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { cleanParams } from '../lib/format'

// Gọi GET và tự tải lại khi path/params đổi. Giữ dữ liệu cũ trong lúc tải trang mới
// để bảng không bị nháy. Trả về { response, data, loading, error, reload }.
export function useApi(path, params = {}) {
  const key = JSON.stringify([path, cleanParams(params)])
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${key}#${reloadToken}`
  const [state, setState] = useState({ key: null, response: null, error: null })

  useEffect(() => {
    if (!path) return undefined
    let cancelled = false
    const [url, query] = JSON.parse(key)
    const thisKey = `${key}#${reloadToken}`
    api
      .get(url, { params: query })
      .then((res) => {
        if (!cancelled) setState({ key: thisKey, response: res.data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ key: thisKey, response: previous.response, error: errorMessage(error) }))
      })
    return () => {
      cancelled = true
    }
  }, [key, reloadToken, path])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    response: state.response,
    data: state.response?.data,
    loading: Boolean(path) && state.key !== requestKey,
    error: state.key === requestKey ? state.error : null,
    reload,
  }
}

// Gửi thao tác ghi (POST/PATCH/PUT), quản lý trạng thái đang gửi.
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (method, url, body) => {
    setBusy(true)
    try {
      const res = await api.request({ method, url, data: body })
      return res.data
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, run }
}
