import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRef, useState } from 'react'

import { AlertTriangle } from 'lucide-react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { errorMessage } from '../lib/api'
import { rejectOrder } from '../services/C06_TuChoiDonHang/rejectionApi'
import { toast } from 'react-toastify'

export default function OrderRejectPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const lock = useRef(false)

  const submit = async event => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 5) {
      setError('Vui lòng nhập lý do từ chối (ít nhất 5 ký tự).')
      return
    }
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await rejectOrder(orderId, trimmedReason)
      setDone(result.data)
      toast.success(result.message)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto min-h-[600px] max-w-2xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-amber-600" />
            <div>
              <h1 className="text-2xl font-black">Từ chối đơn hàng</h1>
              <p className="mt-2 text-sm text-slate-600">
                Đơn #{orderId} chỉ có thể bị từ chối khi đang chờ người bán chấp nhận.
              </p>
            </div>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {done ? (
            <div className="mt-6 space-y-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-bold">Đã từ chối đơn hàng.</p>
              <p>Lý do: {done.cancelReason}</p>
              <p>Sản phẩm {done.listingReopened ? 'đã được mở bán lại.' : 'chưa được mở bán lại.'}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="rejection-reason" className="text-sm font-bold text-slate-700">Lý do từ chối <span className="text-rose-500">*</span></label>
                <textarea
                  id="rejection-reason"
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                  rows={5}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Ví dụ: Sản phẩm vừa phát sinh vấn đề, không thể giao đúng cam kết."
                />
                <p className="mt-1 text-right text-xs text-slate-400">{reason.length}/500</p>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => navigate(-1)} disabled={busy} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Quay lại</button>
                <button type="submit" disabled={busy} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}</button>
              </div>
            </form>
          )}

          <Link to={`/orders/${orderId}/tracking`} className="mt-6 block text-sm font-bold text-emerald-700 underline">Xem theo dõi đơn hàng</Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
