import { useEffect, useState } from 'react'
import { btn } from '../admin/styles'
import { errorMessage } from '../../lib/api'
export default function PrivateDeliveryProof({ orderId, deliveryId, load, title, alt }) {
  const [retry, setRetry] = useState(0), [resource, setResource] = useState(null)
  const key = `${orderId}:${deliveryId}:${retry}`
  useEffect(() => {
    const controller = new AbortController()
    let url
    load(orderId, deliveryId, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob); setResource({ key, url })
    }).catch(async error => {
      let message = errorMessage(error, 'Không tải được ảnh có phân quyền. Kiểm tra kết nối và phiên đăng nhập rồi thử lại.')
      // Axios responseType=blob cũng áp dụng cho JSON lỗi; đọc lý do backend thay vì mất thông báo.
      try { if (error.response?.data instanceof Blob) { const body = JSON.parse(await error.response.data.text()); if (typeof body.message === 'string') message = body.message } } catch { /* Giữ thông báo mạng khi response không phải JSON. */ }
      if (!controller.signal.aborted) setResource({ key, failed: true, message })
    })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [orderId, deliveryId, load, key])
  const current = resource?.key === key ? resource : null
  return <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold">{title}</p>
    {current?.failed ? <><p role="alert" className="mt-2 text-sm text-rose-700">{current.message || 'Không đọc được nội dung ảnh. Vui lòng tải lại.'}</p><button type="button" className={`${btn.secondary} mt-2`} onClick={() => setRetry(n => n + 1)}>Tải lại ảnh</button></>
      : current?.url ? <a href={current.url} target="_blank" rel="noreferrer"><img src={current.url} alt={alt} onError={() => setResource({ key, failed: true })} className="mt-2 max-h-72 max-w-full rounded-xl object-contain" /></a>
        : <p role="status" className="mt-2 text-sm text-slate-600">Đang tải ảnh có phân quyền…</p>}
  </section>
}
