import { useEffect, useState } from 'react'
import { getCompletionProof } from '../../services/D13_XacThucGiaoHangOTP/completionApi'
export default function CompletionProof({ orderId, deliveryId }) {
  const [image, setImage] = useState(null), [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let url
    getCompletionProof(orderId, deliveryId, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob); setImage(url)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [orderId, deliveryId])
  return <div className="mt-3"><p className="font-semibold">Bằng chứng giao hàng (D13)</p>
    {failed ? <p role="alert">Không tải được ảnh bàn giao. Hãy kiểm tra phiên đăng nhập và tải lại.</p>
      : image ? <a href={image} target="_blank" rel="noreferrer"><img src={image} alt={`Bằng chứng giao hàng chuyến #${deliveryId}`} className="mt-2 max-h-72 max-w-full rounded-xl border object-contain" /></a>
        : <p>Đang tải ảnh bàn giao có phân quyền…</p>}</div>
}
