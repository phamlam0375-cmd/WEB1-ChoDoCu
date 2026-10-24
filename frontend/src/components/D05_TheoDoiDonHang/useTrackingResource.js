import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAccessToken, rememberPostLoginUrl } from '../../lib/auth'
import { errorMessage, getDevUserId } from '../../lib/api'
import { isD01DemoEnabled } from '../../lib/d01Demo'
import { ORDER_STATUS } from '../../lib/labels'

function publicError(error) {
  const message = errorMessage(error)
  // Không đưa tên tính năng nội bộ trong lỗi cấu hình demo vào luồng sử dụng.
  return message.replace(/\b[BCD]\d{2}\b/g, 'đơn hàng')
}

export function useTrackingResource(loader, key, poll = false) {
  const navigate = useNavigate(), location = useLocation()
  const [state, setState] = useState(null), [reload, setReload] = useState(0)
  const previous = useRef(null)
  const requestKey = `${key}:${reload}`
  const login = useCallback(() => {
    const returnTo = `${location.pathname}${location.search}`
    rememberPostLoginUrl(returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { from: returnTo } })
  }, [location.pathname, location.search, navigate])
  useEffect(() => {
    if (!getAccessToken() && !getDevUserId() && !isD01DemoEnabled()) { login(); return undefined }
    let controller, disposed = false
    const load = async () => {
      controller?.abort(); controller = new AbortController()
      const signal = controller.signal
      try {
        const response = await loader(JSON.parse(key), signal)
        if (disposed || signal.aborted) return
        const prior = previous.current
        let notice = ''
        if (prior?.key === key && response.version && prior.version !== response.version) {
          notice = prior.status !== response.orderStatus ? `Đơn #${response.orderId} đã chuyển sang ${ORDER_STATUS[response.orderStatus] || 'trạng thái mới'}.` : 'Đã tải tiến trình mới nhất của đơn hàng.'
        }
        previous.current = { key, version: response.version, status: response.orderStatus }
        setState({ key, requestKey, response, error: '', notice })
      } catch (error) {
        if (disposed || signal.aborted) return
        if (error.response?.status === 401) { login(); return }
        // Không giữ dữ liệu/quyền đã bị thu hồi hoặc đơn đã mất.
        setState({ key, requestKey, response: null, error: publicError(error), notice: '' })
      }
    }
    load()
    const timer = poll ? window.setInterval(() => { if (!document.hidden) load() }, 30000) : null
    return () => { disposed = true; controller?.abort(); if (timer) window.clearInterval(timer) }
  }, [loader, key, requestKey, poll, login])
  const refresh = useCallback(() => setReload(value => value + 1), [])
  return { data: state?.key === key ? state.response : null, error: state?.key === key ? state.error : '', notice: state?.key === key ? state.notice : '', loading: state?.requestKey !== requestKey, refresh }
}
