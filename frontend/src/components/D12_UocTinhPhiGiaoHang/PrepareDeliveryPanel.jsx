import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { btn } from '../admin/styles'
import { errorMessage } from '../../lib/api'
import { prepareDelivery } from '../../services/D12_UocTinhPhiGiaoHang/feeApi'
export default function PrepareDeliveryPanel({ orderId, onSaved }) {
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), navigate = useNavigate()
  async function prepare() {
    if (lock.current || !confirmed) return
    lock.current = true; setBusy(true); setError('')
    try { await prepareDelivery(orderId); onSaved() }
    catch (e) {
      if (e.response?.status === 401) navigate(`/login?returnTo=${encodeURIComponent(`/orders/${orderId}/tracking`)}`)
      setError(errorMessage(e))
    } finally { lock.current = false; setBusy(false) }
  }
  return <section className="mt-4 space-y-3 rounded-xl border border-emerald-200 p-4" aria-label="Chuẩn bị giao hàng">
    <h3 className="font-bold">Chuẩn bị giao hàng</h3>
    <p className="text-sm">Tạo chuyến theo địa điểm, tuyến, phương tiện và phí đã chốt khi người mua đặt hàng. Chưa phân công tài xế và chưa cấp mã bàn giao.</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi đã chuẩn bị và đóng gói hàng để bàn giao.</label>
    <button type="button" className={btn.primary} disabled={busy || !confirmed} onClick={prepare}>{busy ? 'Đang xác nhận…' : 'Xác nhận sẵn sàng giao hàng'}</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>
}
