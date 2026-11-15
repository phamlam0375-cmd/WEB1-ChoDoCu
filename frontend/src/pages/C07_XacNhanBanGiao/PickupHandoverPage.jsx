import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, PageHeader } from '../../components/D05_TheoDoiDonHang/OrderUi'
import { btn } from '../../components/admin/styles'
import { errorMessage } from '../../lib/api'
import { confirmPickupHandover } from '../../services/C07_XacNhanBanGiao/pickupHandoverApi'

export default function PickupHandoverPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (lock.current || !confirmed) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await confirmPickupHandover(orderId)
      navigate(`/orders/${orderId}/tracking`, { replace: true })
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <main className="d-workspace mx-auto min-h-[600px] max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader title={`Bàn giao tự đến lấy · Đơn #${orderId}`} description="Chỉ xác nhận sau khi đã giao đúng sản phẩm trực tiếp cho người mua." />
      <Card className="p-5 sm:p-8">
        {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
        <form onSubmit={submit}>
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input type="checkbox" className="mt-1 size-4 accent-emerald-600" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
            Tôi xác nhận đã bàn giao đúng sản phẩm cho người mua tại điểm nhận.
          </label>
          <button type="submit" disabled={busy || !confirmed} className={`${btn.primary} mt-5 w-full`}>{busy ? 'Đang ghi nhận…' : 'Xác nhận bàn giao'}</button>
        </form>
        <Link className={`${btn.secondary} mt-4 w-full`} to={`/orders/${orderId}/tracking`}>Quay lại theo dõi đơn</Link>
      </Card>
    </main>
  </div>
}
