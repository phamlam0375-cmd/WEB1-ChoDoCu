import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { getDevUserId } from '../lib/api'
import { estimateDeliveryFee } from '../services/deliveryFeeApi'
import { createOrder, getOrderPreview } from '../services/orderApi'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const conditionLabels = {
  LIKE_NEW: 'Như mới',
  GOOD: 'Còn tốt',
  FAIR: 'Đã qua sử dụng',
  POOR: 'Cần sửa chữa',
  USED_GOOD: 'Đã qua sử dụng',
}

const initialForm = {
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  deliveryMethod: 'PICKUP',
  note: '',
}

function requestErrorMessage(error, fallback) {
  if (error?.code === 'ERR_NETWORK') return 'Mất kết nối với máy chủ. Vui lòng thử lại.'
  return error?.response?.data?.message || fallback
}

function OrderSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl animate-pulse gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-12" aria-label="Đang tải thông tin đặt hàng">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="h-24 rounded-xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
        </div>
        <div className="h-32 rounded-xl bg-slate-100" />
      </div>
      <div className="h-96 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-44 rounded-xl bg-slate-100" />
        <div className="mt-5 h-5 w-4/5 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-2/5 rounded bg-slate-200" />
      </div>
    </div>
  )
}

function LoadError({ message, onRetry }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <div className="rounded-2xl border border-red-200 bg-white p-7 shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-600"><AlertCircle size={24} /></span>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">Không thể mở trang đặt hàng</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onRetry} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700">
            <RefreshCw size={17} /> Thử lại
          </button>
          <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Về trang chủ</Link>
        </div>
      </div>
    </div>
  )
}

function SuccessView({ order, listing, nowMs }) {
  const remaining = Math.max(0, new Date(order.reservedUntil).getTime() - nowMs)
  const minutes = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
          <div className="bg-emerald-600 px-5 py-8 text-center text-white sm:px-10">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15"><CheckCircle2 size={36} /></span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">Đặt hàng thành công</h1>
            <p className="mt-2 text-sm text-emerald-50">Món đồ đã được giữ riêng cho bạn.</p>
          </div>
          <div className="p-5 sm:p-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-900">Thời gian giữ món còn lại</p>
              <p className="mt-1 font-mono text-3xl font-black tracking-wider text-amber-700" aria-live="polite">{minutes}:{seconds}</p>
              <p className="mt-1 text-xs text-amber-800">Hết thời gian, đơn sẽ tự hủy nếu chưa chuyển sang bước tiếp theo.</p>
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-slate-500">Mã đơn hàng</dt><dd className="mt-1 font-extrabold text-slate-900">#{order.orderId}</dd></div>
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-slate-500">Trạng thái</dt><dd className="mt-1 font-extrabold text-emerald-700">Đang giữ món</dd></div>
              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><dt className="text-slate-500">Sản phẩm</dt><dd className="mt-1 font-bold text-slate-900">{listing.title}</dd></div>
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-slate-500">Hình thức nhận</dt><dd className="mt-1 font-bold text-slate-900">{order.deliveryMethod === 'PICKUP' ? 'Tự đến lấy' : 'Giao hàng'}</dd></div>
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-slate-500">Tổng thanh toán</dt><dd className="mt-1 text-lg font-black text-emerald-700">{money.format(order.totalAmount)}</dd></div>
            </dl>

            <div className="mt-6 rounded-2xl border border-slate-200 p-5">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900"><PackageCheck size={19} className="text-emerald-600" /> Bước tiếp theo</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Người bán đã nhận được thông báo. Theo dõi đơn hàng và liên hệ người bán để thống nhất thời gian nhận món.</p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700">Tiếp tục mua sắm</Link>
              <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-6 text-sm font-bold text-slate-700 hover:bg-slate-50">Về trang chủ</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function OrderCreatePage() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const submittingRef = useRef(false)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loadState, setLoadState] = useState({ loading: true, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [deliveryQuote, setDeliveryQuote] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    if (getDevUserId()) return undefined
    const returnTo = `${location.pathname}${location.search}`
    sessionStorage.setItem('postLoginRedirect', returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { from: returnTo } })
    return undefined
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!getDevUserId()) return undefined
    const controller = new AbortController()
    async function load() {
      try {
        const data = await getOrderPreview(listingId, { signal: controller.signal })
        setPreview(data)
        setForm((current) => ({
          ...current,
          receiverName: current.receiverName || data.buyer.fullName,
          receiverPhone: current.receiverPhone || data.buyer.phone,
          receiverAddress: current.receiverAddress || data.buyer.address,
        }))
        setLoadState({ loading: false, error: '' })
      } catch (error) {
        if (error.code === 'ERR_CANCELED') return
        if (error.response?.status === 401) {
          const returnTo = `${location.pathname}${location.search}`
          sessionStorage.setItem('postLoginRedirect', returnTo)
          navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
          return
        }
        setLoadState({
          loading: false,
          error: requestErrorMessage(error, 'Không tải được thông tin sản phẩm. Vui lòng thử lại.'),
        })
      }
    }
    void load()
    return () => controller.abort()
  }, [listingId, location.pathname, location.search, navigate, reloadKey])

  useLayoutEffect(() => {
    if (success) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [success])

  useEffect(() => {
    if (!success) return undefined
    const tick = () => setNowMs(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [success])

  const deliveryAvailable = Boolean(preview?.delivery?.available)
  const productAmount = Number(preview?.listing?.price || 0)
  const deliveryFee = form.deliveryMethod === 'DELIVERY' ? Number(deliveryQuote?.amount || 0) : 0
  const total = useMemo(() => productAmount + deliveryFee, [deliveryFee, productAmount])
  const unavailable = preview && (!preview.listing.isAvailable || preview.listing.isOwnListing)
  const receiverPhoneValid = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/.test(form.receiverPhone.replace(/[.\s-]/g, ''))
  const hasDeliveryDetails = form.deliveryMethod === 'PICKUP'
    || (form.receiverAddress.trim() && deliveryQuote?.quoteId)
  const canSubmit = Boolean(
    form.receiverName.trim()
    && receiverPhoneValid
    && form.note.trim().length <= 500
    && hasDeliveryDetails
    && !unavailable
  )

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    if (field === 'receiverAddress') setDeliveryQuote(null)
  }

  const validate = () => {
    const errors = {}
    if (!form.receiverName.trim()) errors.receiverName = 'Vui lòng nhập họ tên người nhận.'
    if (!/^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/.test(form.receiverPhone.replace(/[.\s-]/g, ''))) errors.receiverPhone = 'Số điện thoại Việt Nam không hợp lệ.'
    if (form.deliveryMethod === 'DELIVERY' && !form.receiverAddress.trim()) errors.receiverAddress = 'Vui lòng nhập địa chỉ nhận hàng.'
    if (form.deliveryMethod === 'DELIVERY' && !deliveryQuote?.quoteId) errors.deliveryQuoteId = 'Vui lòng tính phí giao hàng.'
    if (form.note.trim().length > 500) errors.note = 'Ghi chú tối đa 500 ký tự.'
    setFieldErrors(errors)
    if (errors.receiverName || errors.receiverPhone || errors.receiverAddress) {
      toast.error('Vui lòng nhập đầy đủ thông tin người nhận.', { toastId: 'receiver-info-required' })
    }
    return Object.keys(errors).length === 0
  }

  const handleEstimate = async () => {
    if (!form.receiverAddress.trim()) {
      setFieldErrors((current) => ({ ...current, receiverAddress: 'Vui lòng nhập địa chỉ nhận hàng.' }))
      return
    }
    setEstimating(true)
    try {
      const quote = await estimateDeliveryFee({ listingId: Number(listingId), receiverAddress: form.receiverAddress.trim() })
      setDeliveryQuote(quote)
      setFieldErrors((current) => ({ ...current, deliveryQuoteId: undefined }))
    } catch (error) {
      toast.error(requestErrorMessage(error, 'Không thể tính phí giao hàng.'), {
        toastId: error.response?.data?.code || error.code || 'delivery-estimate-error',
      })
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || unavailable || !validate()) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const response = await createOrder({
        listingId: Number(listingId),
        deliveryMethod: form.deliveryMethod,
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        receiverAddress: form.deliveryMethod === 'DELIVERY' ? form.receiverAddress.trim() : undefined,
        deliveryQuoteId: form.deliveryMethod === 'DELIVERY' ? deliveryQuote.quoteId : undefined,
        note: form.note.trim() || undefined,
      })
      setSuccess(response.data)
      toast.success(response.message, { toastId: `order-${response.data.orderId}-created` })
    } catch (error) {
      const data = error.response?.data
      if (data?.errors?.fields) setFieldErrors(data.errors.fields)
      if (error.response?.status === 409) {
        setPreview((current) => current ? { ...current, listing: { ...current.listing, isAvailable: false, status: 'RESERVED' } } : current)
      }
      toast.error(requestErrorMessage(error, 'Không thể đặt hàng. Vui lòng thử lại.'), {
        toastId: data?.code || error.code || 'create-order-error',
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const retry = () => {
    setLoadState({ loading: true, error: '' })
    setReloadKey((value) => value + 1)
  }

  if (!getDevUserId()) return null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      {loadState.loading ? <OrderSkeleton /> : loadState.error ? <LoadError message={loadState.error} onRetry={retry} /> : success ? (
        <SuccessView order={success} listing={preview.listing} nowMs={nowMs} />
      ) : (
        <main>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-700"><ChevronLeft size={17} /> Quay lại mua sắm</Link>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Xác nhận đơn hàng</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Đặt hàng và giữ món</h1>
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-500"><Clock3 size={16} /> Giữ món trong {preview.reservationMinutes} phút sau khi đặt</p>
            </div>

            {unavailable && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
                <AlertCircle size={20} className="mt-0.5 shrink-0" />
                <div><b>{preview.listing.isOwnListing ? 'Bạn không thể mua sản phẩm của chính mình.' : 'Sản phẩm hiện không còn khả dụng.'}</b><p className="mt-1 text-amber-800">Hãy quay lại danh sách và chọn một sản phẩm khác.</p></div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-extrabold">Thông tin người nhận</h2>
                  <p className="mt-1 text-sm text-slate-500">Kiểm tra kỹ để người bán có thể liên hệ với bạn.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-bold text-slate-700">Họ và tên <span className="text-red-500">*</span>
                      <input value={form.receiverName} onChange={(event) => updateField('receiverName', event.target.value)} maxLength={100} autoComplete="name" className={`mt-2 h-12 w-full rounded-xl border bg-white px-3.5 font-normal outline-none transition focus:ring-2 focus:ring-emerald-200 ${fieldErrors.receiverName ? 'border-red-400' : 'border-slate-200 focus:border-emerald-500'}`} />
                      {fieldErrors.receiverName && <span className="mt-1.5 block text-xs font-medium text-red-600">{fieldErrors.receiverName}</span>}
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Số điện thoại <span className="text-red-500">*</span>
                      <input value={form.receiverPhone} onChange={(event) => updateField('receiverPhone', event.target.value)} maxLength={15} inputMode="tel" autoComplete="tel" className={`mt-2 h-12 w-full rounded-xl border bg-white px-3.5 font-normal outline-none transition focus:ring-2 focus:ring-emerald-200 ${fieldErrors.receiverPhone ? 'border-red-400' : 'border-slate-200 focus:border-emerald-500'}`} />
                      {fieldErrors.receiverPhone && <span className="mt-1.5 block text-xs font-medium text-red-600">{fieldErrors.receiverPhone}</span>}
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-extrabold">Hình thức nhận hàng</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${form.deliveryMethod === 'PICKUP' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}>
                      <input type="radio" name="deliveryMethod" value="PICKUP" checked={form.deliveryMethod === 'PICKUP'} onChange={() => updateField('deliveryMethod', 'PICKUP')} className="mt-1 accent-emerald-600" />
                      <span><span className="flex items-center gap-2 font-extrabold"><Store size={18} /> Tự đến lấy</span><span className="mt-1 block text-xs leading-5 text-slate-600">Thống nhất địa điểm với người bán sau khi đặt.</span></span>
                    </label>
                    <label className={`flex gap-3 rounded-2xl border p-4 ${deliveryAvailable ? 'cursor-pointer transition hover:border-emerald-300' : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'} ${form.deliveryMethod === 'DELIVERY' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : ''}`}>
                      <input type="radio" name="deliveryMethod" value="DELIVERY" disabled={!deliveryAvailable} checked={form.deliveryMethod === 'DELIVERY'} onChange={() => updateField('deliveryMethod', 'DELIVERY')} className="mt-1 accent-emerald-600" />
                      <span><span className="flex items-center gap-2 font-extrabold"><Truck size={18} /> Giao hàng</span><span className="mt-1 block text-xs leading-5 text-slate-600">{deliveryAvailable ? 'Phí được tính theo báo giá của dịch vụ giao hàng.' : preview.delivery.message}</span></span>
                    </label>
                  </div>

                  {form.deliveryMethod === 'DELIVERY' && (
                    <div className="mt-5">
                      <label className="block text-sm font-bold text-slate-700">Địa chỉ nhận hàng <span className="text-red-500">*</span>
                        <textarea value={form.receiverAddress} onChange={(event) => updateField('receiverAddress', event.target.value)} maxLength={255} rows={3} autoComplete="street-address" className={`mt-2 w-full resize-y rounded-xl border bg-white px-3.5 py-3 font-normal outline-none focus:ring-2 focus:ring-emerald-200 ${fieldErrors.receiverAddress ? 'border-red-400' : 'border-slate-200 focus:border-emerald-500'}`} />
                      </label>
                      {fieldErrors.receiverAddress && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.receiverAddress}</p>}
                      <button type="button" onClick={handleEstimate} disabled={estimating} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 disabled:opacity-60">
                        {estimating && <LoaderCircle size={16} className="animate-spin" />} Tính phí giao hàng
                      </button>
                      {fieldErrors.deliveryQuoteId && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.deliveryQuoteId}</p>}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <label className="block text-lg font-extrabold">Ghi chú cho người bán <span className="text-sm font-normal text-slate-400">(không bắt buộc)</span>
                    <textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} maxLength={500} rows={4} placeholder="Ví dụ: Gọi cho mình trước khi gặp..." className={`mt-3 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-200 ${fieldErrors.note ? 'border-red-400' : 'border-slate-200 focus:border-emerald-500'}`} />
                  </label>
                  <div className="mt-1 flex justify-between text-xs"><span className="text-red-600">{fieldErrors.note}</span><span className="text-slate-400">{form.note.length}/500</span></div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-extrabold">Tóm tắt thanh toán</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Tiền sản phẩm</dt><dd className="font-bold">{money.format(productAmount)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Phí giao hàng</dt><dd className="font-bold">{form.deliveryMethod === 'PICKUP' ? '0 ₫' : deliveryQuote ? money.format(deliveryFee) : 'Chưa tính'}</dd></div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-3"><dt className="font-extrabold">Tổng thanh toán</dt><dd className="text-xl font-black text-emerald-700">{money.format(total)}</dd></div>
                  </dl>
                  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" /> Giá và người bán được xác nhận trực tiếp từ hệ thống. Bạn không bị trừ tiền ở bước này.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                    <Link to="/" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Quay lại</Link>
                    <button type="submit" disabled={submitting || !canSubmit} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                      {submitting ? <><LoaderCircle size={18} className="animate-spin" /> Đang giữ món...</> : <><PackageCheck size={18} /> Đặt hàng và giữ món</>}
                    </button>
                  </div>
                </section>
              </div>

              <aside className="order-first rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-lg font-extrabold">Thông tin sản phẩm</h2>
                <div className="mt-4 overflow-hidden rounded-xl bg-slate-100">
                  <img src={preview.listing.imageUrl || '/product-placeholder.svg'} alt={preview.listing.title} onError={(event) => { event.currentTarget.src = '/product-placeholder.svg' }} className="aspect-[16/10] w-full object-cover" />
                </div>
                <h3 className="mt-4 text-base font-extrabold leading-6">{preview.listing.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">Còn hàng</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{conditionLabels[preview.listing.condition] || preview.listing.condition}</span>
                  {preview.listing.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {preview.listing.location}</span>}
                </div>
                <div className="mt-4 flex items-center gap-2 border-y border-slate-100 py-3 text-sm">
                  <span className="grid size-8 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700">{preview.listing.seller.name?.charAt(0)}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{preview.listing.seller.name}</span>
                  {preview.listing.seller.verified && <BadgeCheck size={18} className="fill-sky-500 text-white" aria-label="Người bán đã xác minh" />}
                </div>
                <p className="mt-4 text-2xl font-black text-emerald-700">{money.format(productAmount)}</p>
              </aside>
            </form>
          </div>
        </main>
      )}
      <Footer />
    </div>
  )
}
