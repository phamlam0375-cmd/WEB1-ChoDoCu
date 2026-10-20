import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRef, useState } from 'react'

import { CheckCircle2, XCircle } from 'lucide-react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { errorMessage } from '../lib/api'
import { confirmOrder } from '../services/orderConfirmationApi'
import { toast } from 'react-toastify'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const lock = useRef(false)

  const submit = async event => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await confirmOrder(orderId, {
        action: 'ACCEPT',
        available,
      })
      setDone(result.data)
      toast.success(result.message)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const reject = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await confirmOrder(orderId, {
        action: 'REJECT',
        reason: reason.trim() || undefined,
      })
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
            <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-black">Xác nhận đơn hàng</h1>
              <p className="mt-2 text-sm text-slate-600">
                Kiểm tra tình trạng sản phẩm trước khi tiếp tục xử lý đơn #{orderId}.
              </p>
            </div>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {done ? (
            <div className="mt-6 space-y-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-bold">{done.status === 'WAITING_PAYMENT' ? 'Đã chấp nhận đơn hàng.' : 'Đã từ chối đơn hàng.'}</p>
              {done.cancelReason && <p>Lý do: {done.cancelReason}</p>}
              {done.status === 'CANCELLED' && <p>Sản phẩm {done.listingReopened ? 'đã được mở bán lại.' : 'chưa được mở bán lại.'}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <fieldset>
                <legend className="text-sm font-bold text-slate-700">Tình trạng sản phẩm</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className={`cursor-pointer rounded-xl border p-4 ${available ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <input type="radio" name="availability" checked={available} onChange={() => setAvailable(true)} className="sr-only" />
                    <span className="flex items-center gap-2 font-bold text-slate-800"><CheckCircle2 size={18} className="text-emerald-600" />Còn hàng</span>
                    <span className="mt-1 block text-sm text-slate-600">Xác nhận sản phẩm còn hàng để tiếp tục xử lý đơn.</span>
                  </label>
                  <label className={`cursor-pointer rounded-xl border p-4 ${!available ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`}>
                    <input type="radio" name="availability" checked={!available} onChange={() => setAvailable(false)} className="sr-only" />
                    <span className="flex items-center gap-2 font-bold text-slate-800"><XCircle size={18} className="text-rose-600" />Hết hàng</span>
                    <span className="mt-1 block text-sm text-slate-600">Xác nhận sản phẩm hết hàng.</span>
                  </label>
                </div>
              </fieldset>
              <div>
                <label htmlFor="rejection-reason" className="text-sm font-bold text-slate-700">Lý do từ chối <span className="font-normal text-slate-400">(không bắt buộc)</span></label>
                <textarea
                  id="rejection-reason"
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Ví dụ: Sản phẩm vừa phát sinh vấn đề, không thể giao đúng cam kết."
                />
                <p className={`mt-1 text-right text-xs ${reason.length > 500 ? 'text-rose-600' : 'text-slate-400'}`}>{reason.length}/500</p>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => navigate(-1)} disabled={busy} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Quay lại</button>
                <button type="button" onClick={reject} disabled={busy || reason.length > 500} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Đang xử lý...' : 'Từ chối'}</button>
                <button type="submit" disabled={busy || reason.length > 500} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Đang xử lý...' : 'Chấp nhận'}</button>
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
