import { useEffect, useState } from 'react'
import { getPickupProof } from '../../services/D08_XacNhanLayHang/pickupApi'
export default function PickupProof({ orderId, deliveryId }) {
  const [image, setImage] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let url
    getPickupProof(orderId, deliveryId, { signal: controller.signal }).then(blob => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob); setImage(url)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [orderId, deliveryId])
  return <div className="mt-3">
    <p className="text-sm font-semibold">Bằng chứng lấy hàng (D08)</p>
    {failed ? <p role="alert" className="mt-2 text-sm text-rose-700">Không tải được ảnh. Cần phiên đăng nhập thật và quyền liên quan đến đơn/chuyến.</p>
      : image ? <a href={image} target="_blank" rel="noreferrer"><img src={image} alt={`Bằng chứng lấy hàng chuyến #${deliveryId}`} className="mt-2 max-h-72 max-w-full rounded-xl border border-slate-200 object-contain" /></a>
        : <p className="mt-2 text-sm text-slate-500">Đang tải ảnh có phân quyền…</p>}
  </div>
}
