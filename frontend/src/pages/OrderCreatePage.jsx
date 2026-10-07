import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { errorMessage, getDevUserId } from '../lib/api'
import { getAccessToken, rememberPostLoginUrl } from '../lib/auth'
import { estimateDeliveryFee } from '../services/deliveryFeeApi'
import { createOrder, getOrderPreview } from '../services/orderApi'

const inputClass = 'mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-100'
const conditionLabels = {
  LIKE_NEW: 'Như mới', GOOD: 'Còn tốt', FAIR: 'Đã qua sử dụng',
  POOR: 'Cần sửa chữa', USED_GOOD: 'Đã qua sử dụng',
}
const hasSession = () => Boolean(getAccessToken() || getDevUserId())
const phonePattern = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value) || 0)

const formatDateTime = (value) => new Intl.DateTimeFormat('vi-VN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value))

function getErrorCode(error) {
  return error.response?.data?.code || error.response?.data?.error?.code
}

function getErrorMessage(error) {
  return errorMessage(error, error.response?.data?.error?.message
    || 'Không thể xử lý yêu cầu. Vui lòng thử lại.')
}

function getCountdown(target, now) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function FieldError({ id, children }) {
  if (!children) return null
  return <p id={id} className="mt-1.5 text-xs font-medium text-rose-600">{children}</p>
}

function OrderSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-9 w-72 rounded-lg bg-slate-200" />
      <div className="mt-8 grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-5 bg-slate-50 p-6 sm:p-8">
          <div className="aspect-[4/3] rounded-2xl bg-slate-200" />
          <div className="h-7 w-4/5 rounded bg-slate-200" />
          <div className="h-6 w-2/5 rounded bg-slate-200" />
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-12 rounded-xl bg-slate-100" />)}
          <div className="h-36 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

function StateCard({ icon: Icon, title, description, actionLabel, onAction, onRetry }) {
  return (
    <div className="mx-auto grid min-h-[520px] max-w-2xl place-items-center px-4 py-12 text-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50 text-amber-600">
          <Icon size={30} />
        </span>
        <h1 className="mt-5 text-2xl font-black text-slate-900">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
        <button type="button" onClick={onAction} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
          <ArrowLeft size={17} />
          {actionLabel}
        </button>
        {onRetry && <button type="button" onClick={onRetry} className="ml-3 mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-600 px-5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"><RefreshCw size={17} /> Thử lại</button>}
      </div>
    </div>
  )
}

function OrderCreatePage() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const submitLock = useRef(false)
  const expirationToastShown = useRef(false)
  const quoteRequest = useRef(0)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [quote, setQuote] = useState(null)
  const [success, setSuccess] = useState(null)
  const [nowMs, setNowMs] = useState(0)
  const [form, setForm] = useState({
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',
    deliveryMethod: 'PICKUP',
    note: '',
  })

  const returnTo = `${location.pathname}${location.search}`

  const redirectToLogin = useCallback(() => {
    rememberPostLoginUrl(returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
      replace: true,
      state: { from: returnTo },
    })
  }, [navigate, returnTo])

  useEffect(() => {
    if (!hasSession()) {
      redirectToLogin()
      return undefined
    }

    const controller = new AbortController()
    const load = async () => {
      try {
        const data = await getOrderPreview(listingId, { signal: controller.signal })
        if (controller.signal.aborted) return
        setPreview(data)
        setForm((current) => ({
          ...current,
          receiverName: current.receiverName || data.buyer?.fullName || '',
          receiverPhone: current.receiverPhone || data.buyer?.phone || '',
          receiverAddress: current.receiverAddress || data.buyer?.address || '',
        }))
        setLoadError(null)
      } catch (error) {
        if (error.code === 'ERR_CANCELED') return
        if (error.response?.status === 401) {
          redirectToLogin()
          return
        }
        setLoadError({
          code: getErrorCode(error),
          message: error.response
            ? getErrorMessage(error)
            : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
        })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [listingId, redirectToLogin, reloadKey])

  useLayoutEffect(() => {
    if (success) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [success])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    setReloadKey((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!success && !quote) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [quote, success])

  const quoteValid = Boolean(
    quote?.quoteId
    && preview?.delivery?.available
    && Number.isFinite(new Date(quote.expiresAt).getTime())
    && new Date(quote.expiresAt).getTime() > nowMs,
  )
  const productAmount = Number(preview?.listing?.price) || 0
  const deliveryFee = form.deliveryMethod === 'DELIVERY' && quoteValid
    ? Number(quote.amount) || 0
    : 0
  const totalAmount = productAmount + deliveryFee
  const normalizedPhone = form.receiverPhone.trim().replace(/[.\s-]/g, '')
  const hasRequiredFields = Boolean(
    form.receiverName.trim()
    && phonePattern.test(normalizedPhone)
    && (
      form.deliveryMethod === 'PICKUP'
      || (form.receiverAddress.trim() && quoteValid)
    ),
  )
  const canSubmit = Boolean(
    hasRequiredFields
    && preview?.listing?.isAvailable
    && !preview?.listing?.isOwnListing
    && form.note.trim().length <= 500
    && !submitting,
  )

  useEffect(() => {
    if (!success || new Date(success.reservedUntil).getTime() > nowMs || expirationToastShown.current) return
    expirationToastShown.current = true
    toast.info('Đơn đã hết thời gian giữ; hệ thống đang tự động xử lý hủy đơn.', {
      toastId: `reservation-expired-${success.orderId}`,
    })
  }, [nowMs, success])

  const validate = () => {
    const nextErrors = {}
    if (!form.receiverName.trim()) nextErrors.receiverName = 'Vui lòng nhập họ tên người nhận.'
    if (!form.receiverPhone.trim()) nextErrors.receiverPhone = 'Vui lòng nhập số điện thoại.'
    else if (!phonePattern.test(normalizedPhone)) nextErrors.receiverPhone = 'Số điện thoại Việt Nam không hợp lệ.'
    if (form.deliveryMethod === 'DELIVERY' && !form.receiverAddress.trim()) {
      nextErrors.receiverAddress = 'Vui lòng nhập địa chỉ nhận hàng.'
    }
    if (form.note.length > 500) nextErrors.note = 'Ghi chú tối đa 500 ký tự.'
    if (form.deliveryMethod === 'DELIVERY' && !quoteValid) {
      nextErrors.deliveryQuote = 'Vui lòng tính lại phí giao hàng trước khi đặt.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '', deliveryQuote: '' }))
    setSubmitError('')
    if (field === 'receiverAddress') {
      quoteRequest.current += 1
      setQuote(null)
    }
  }

  const handleMethodChange = (deliveryMethod) => {
    quoteRequest.current += 1
    setForm((current) => ({ ...current, deliveryMethod }))
    setQuote(null)
    setErrors((current) => ({
      ...current,
      receiverAddress: '',
      deliveryQuote: '',
    }))
    setSubmitError('')
  }

  const handleEstimate = async () => {
    if (!preview.delivery.available) {
      toast.info('Dịch vụ ước tính phí giao hàng chưa sẵn sàng; hãy chọn tự đến lấy.', {
        toastId: 'delivery-service-unavailable',
      })
      return
    }
    if (!form.receiverAddress.trim()) {
      setErrors((current) => ({ ...current, receiverAddress: 'Vui lòng nhập địa chỉ nhận hàng.' }))
      return
    }

    const requestId = ++quoteRequest.current
    setEstimating(true)
    try {
      const result = await estimateDeliveryFee({
        listingId: Number(listingId),
        receiverAddress: form.receiverAddress.trim(),
      })
      if (requestId !== quoteRequest.current) return
      setQuote({
        quoteId: result.quoteId || result.signedQuoteToken || result.token,
        amount: result.amount,
        deliveryFeeRuleId: result.deliveryFeeRuleId,
        expiresAt: result.expiresAt,
      })
      setNowMs(Date.now())
      setErrors((current) => ({ ...current, deliveryQuote: '' }))
    } catch (error) {
      if (requestId !== quoteRequest.current) return
      const code = getErrorCode(error)
      if (code === 'DELIVERY_ROUTE_UNSUPPORTED') {
        setSubmitError('Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.')
      } else {
        setSubmitError(getErrorMessage(error))
      }
      toast.error(getErrorMessage(error), { toastId: `delivery-${code || 'error'}` })
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitLock.current || submitting) return
    if (!validate()) {
      toast.error('Vui lòng nhập đầy đủ thông tin người nhận.', { toastId: 'order-required-fields' })
      return
    }
    if (!preview.listing.isAvailable || preview.listing.isOwnListing) return

    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await createOrder({
        listingId: Number(listingId),
        deliveryMethod: form.deliveryMethod,
        receiverName: form.receiverName.trim(),
        receiverPhone: normalizedPhone,
        ...(form.deliveryMethod === 'DELIVERY' && {
          receiverAddress: form.receiverAddress.trim(),
          deliveryQuoteId: quote.quoteId,
        }),
        ...(form.note.trim() && { note: form.note.trim() }),
      })
      setSuccess(response.data)
      setNowMs(Date.now())
      window.scrollTo({ top: 0 })
      toast.success(response.message, { toastId: `order-created-${response.data.orderId}` })
    } catch (error) {
      const code = getErrorCode(error)
      const fields = error.response?.data?.errors?.fields || error.response?.data?.error?.details?.fields
      if (fields && !Array.isArray(fields)) {
        setErrors({ ...fields, deliveryQuote: fields.deliveryQuoteId })
      }
      if (error.response?.status === 401) {
        redirectToLogin()
        return
      }
      if (['LISTING_UNAVAILABLE', 'RESERVATION_CONFLICT'].includes(code)) {
        setPreview((current) => current && ({
          ...current,
          listing: { ...current.listing, isAvailable: false, status: 'RESERVED' },
        }))
        setSubmitError('Sản phẩm hiện không còn khả dụng.')
        toast.error('Sản phẩm hiện không còn khả dụng.', { toastId: 'listing-unavailable' })
      } else if (code === 'DELIVERY_QUOTE_EXPIRED') {
        setQuote(null)
        setSubmitError('Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.')
        toast.error('Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.', { toastId: 'delivery-quote-expired' })
      } else if (code === 'DELIVERY_ROUTE_UNSUPPORTED') {
        setSubmitError('Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.')
        toast.error('Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.', { toastId: 'delivery-route-unsupported' })
      } else {
        const message = error.response
          ? getErrorMessage(error)
          : 'Mất kết nối đến máy chủ. Vui lòng thử lại.'
        setSubmitError(message)
        toast.error(message, { toastId: `order-${code || 'network-error'}` })
      }
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const content = useMemo(() => {
    if (loading) return <OrderSkeleton />
    if (loadError) {
      const missing = loadError.code === 'LISTING_NOT_FOUND'
      return (
        <StateCard
          icon={missing ? PackageCheck : AlertCircle}
          title={missing ? 'Không tìm thấy sản phẩm' : 'Không thể tải thông tin đặt hàng'}
          description={loadError.message}
          actionLabel="Quay lại trang chủ"
          onAction={() => navigate('/')}
          onRetry={retry}
        />
      )
    }
    return null
  }, [loadError, loading, navigate, retry])

  if (!hasSession()) return null

  if (loading || loadError) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header />
        <main>{content}</main>
        <Footer />
      </div>
    )
  }

  if (success) {
    const expired = new Date(success.reservedUntil).getTime() <= nowMs
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header />
        <main className="mx-auto grid min-h-[620px] max-w-3xl place-items-center px-4 py-12 sm:px-6">
          <section className="w-full rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-lg shadow-emerald-900/5 sm:p-10" aria-live="polite">
            <span className="mx-auto grid size-18 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={38} />
            </span>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-600">Đặt hàng thành công</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Sản phẩm đã được giữ cho bạn</h1>
            <div className="mx-auto mt-7 grid max-w-lg gap-3 rounded-2xl bg-slate-50 p-5 text-left text-sm sm:grid-cols-2">
              <div><span className="text-slate-500">Mã đơn hàng</span><strong className="mt-1 block text-lg text-slate-900">#{success.orderId}</strong></div>
              <div><span className="text-slate-500">Trạng thái</span><strong className="mt-1 block text-emerald-700">{expired ? 'ĐÃ HẾT HẠN' : 'ĐANG GIỮ MÓN'}</strong></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Sản phẩm</span><strong className="mt-1 block text-slate-900">{preview.listing.title}</strong></div>
              <div><span className="text-slate-500">Hình thức nhận</span><strong className="mt-1 block text-slate-900">{success.deliveryMethod === 'PICKUP' ? 'Tự đến lấy' : 'Giao hàng'}</strong></div>
              <div><span className="text-slate-500">Tổng thanh toán</span><strong className="mt-1 block text-emerald-700">{formatCurrency(success.totalAmount)}</strong></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Giữ đến</span><strong className="mt-1 block text-slate-900">{formatDateTime(success.reservedUntil)}</strong></div>
            </div>
            <div className={`mx-auto mt-5 flex max-w-lg items-center justify-center gap-2 rounded-xl px-4 py-3 font-mono text-2xl font-black ${expired ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <Clock3 size={22} />
              {getCountdown(success.reservedUntil, nowMs)}
            </div>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-slate-500">
              {expired
                ? 'Thời gian giữ đã hết. Hệ thống sẽ tự động hủy đơn và mở lại sản phẩm.'
                : 'Người bán đã nhận được thông báo. Liên hệ người bán để thống nhất thời gian nhận món.'}
            </p>
            <button type="button" onClick={() => navigate('/')} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
              <Store size={17} />
              Về trang chủ
            </button>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  const { listing } = preview
  if (!listing.isAvailable || listing.isOwnListing) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header />
        <main>
          <StateCard
            icon={listing.isOwnListing ? ShieldCheck : PackageCheck}
            title={listing.isOwnListing ? 'Đây là sản phẩm của bạn' : 'Sản phẩm không còn khả dụng'}
            description={listing.isOwnListing
              ? 'Bạn không thể đặt mua sản phẩm do chính mình đăng bán.'
              : 'Sản phẩm đang được giữ, đã bán hoặc không còn mở bán.'}
            actionLabel="Quay lại"
            onAction={goBack}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
          <ArrowLeft size={17} />
          Quay lại
        </button>
        <div className="mt-4">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-600">Xác nhận thông tin</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#081426] sm:text-4xl">Đặt hàng và giữ món</h1>
          <p className="mt-2 text-sm text-slate-500">Kiểm tra sản phẩm và thông tin nhận hàng trước khi xác nhận.</p>
        </div>

        <div className="mt-7 grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="border-b border-slate-200 bg-slate-50/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={listing.imageUrl || '/product-placeholder.svg'}
                alt={listing.title}
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = '/product-placeholder.svg'
                }}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Còn hàng</span>
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{conditionLabels[listing.condition] || listing.condition}</span>
            </div>
            <h2 className="mt-4 text-xl font-black leading-7 text-slate-900">{listing.title}</h2>
            <p className="mt-2 text-2xl font-black text-emerald-700">{formatCurrency(listing.price)}</p>
            <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm text-slate-600">
              <p className="flex items-center gap-2"><MapPin size={17} className="shrink-0 text-emerald-600" /> {listing.location || 'Chưa cập nhật khu vực'}</p>
              <p className="flex items-center gap-2">
                <UserRound size={17} className="shrink-0 text-emerald-600" />
                <span>{listing.seller.name}</span>
                {listing.seller.verified && <BadgeCheck size={17} className="fill-sky-500 text-white" aria-label="Người bán đã xác minh" />}
              </p>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="p-5 sm:p-7" noValidate>
            <h2 className="text-xl font-black text-slate-900">Thông tin người nhận</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700" htmlFor="receiver-name">
                Họ và tên người nhận <span className="text-rose-600">*</span>
                <input id="receiver-name" value={form.receiverName} onChange={(event) => updateField('receiverName', event.target.value)} className={inputClass} maxLength={100} autoComplete="name" aria-invalid={Boolean(errors.receiverName)} aria-describedby={errors.receiverName ? 'receiver-name-error' : undefined} />
                <FieldError id="receiver-name-error">{errors.receiverName}</FieldError>
              </label>
              <label className="block text-sm font-bold text-slate-700" htmlFor="receiver-phone">
                Số điện thoại <span className="text-rose-600">*</span>
                <input id="receiver-phone" type="tel" value={form.receiverPhone} onChange={(event) => updateField('receiverPhone', event.target.value)} className={inputClass} maxLength={15} autoComplete="tel" aria-invalid={Boolean(errors.receiverPhone)} aria-describedby={errors.receiverPhone ? 'receiver-phone-error' : undefined} />
                <FieldError id="receiver-phone-error">{errors.receiverPhone}</FieldError>
              </label>
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-bold text-slate-700">Hình thức nhận hàng <span className="text-rose-600">*</span></legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { value: 'PICKUP', label: 'Tự đến lấy hàng', icon: Store, description: 'Không mất phí giao hàng' },
                  { value: 'DELIVERY', label: 'Giao hàng tận nơi', icon: Truck, description: preview.delivery.available ? 'Phí theo báo giá giao hàng' : preview.delivery.message },
                ].map(({ value, label, icon: Icon, description }) => (
                  <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-emerald-500 ${form.deliveryMethod === value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="deliveryMethod" value={value} checked={form.deliveryMethod === value} onChange={() => handleMethodChange(value)} className="mt-1 accent-emerald-600" />
                    <span><span className="flex items-center gap-2 text-sm font-black text-slate-800"><Icon size={17} /> {label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.deliveryMethod === 'DELIVERY' && (
              <div className="mt-5">
                <label className="block text-sm font-bold text-slate-700" htmlFor="receiver-address">
                  Địa chỉ nhận hàng <span className="text-rose-600">*</span>
                  <input id="receiver-address" value={form.receiverAddress} onChange={(event) => updateField('receiverAddress', event.target.value)} className={inputClass} maxLength={255} autoComplete="street-address" aria-invalid={Boolean(errors.receiverAddress)} aria-describedby={errors.receiverAddress ? 'receiver-address-error' : undefined} />
                  <FieldError id="receiver-address-error">{errors.receiverAddress}</FieldError>
                </label>
                {!preview.delivery.available ? (
                  <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800" role="status">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>Dịch vụ ước tính phí giao hàng chưa sẵn sàng; hãy chọn tự đến lấy.</span>
                  </div>
                ) : (
                  <button type="button" disabled={estimating || !form.receiverAddress.trim()} onClick={handleEstimate} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {estimating ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                    {estimating ? 'Đang tính phí...' : 'Tính phí giao hàng'}
                  </button>
                )}
                <FieldError id="delivery-quote-error">{errors.deliveryQuote}</FieldError>
                {quote && !quoteValid && <p className="mt-2 text-sm font-medium text-rose-600">Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.</p>}
              </div>
            )}

            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="buyer-note">
              Ghi chú <span className="font-normal text-slate-400">(không bắt buộc)</span>
              <textarea id="buyer-note" value={form.note} onChange={(event) => updateField('note', event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" maxLength={500} placeholder="Ví dụ: Gọi điện trước khi giao" aria-invalid={Boolean(errors.note)} aria-describedby="buyer-note-help" />
              <span id="buyer-note-help" className="mt-1 flex justify-between text-xs font-normal text-slate-400"><span>{errors.note || 'Thông tin thêm cho người bán'}</span><span>{form.note.length}/500</span></span>
            </label>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4 text-sm text-slate-600"><span>Tiền sản phẩm</span><strong className="text-slate-900">{formatCurrency(productAmount)}</strong></div>
              <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600"><span>Phí giao hàng</span><strong className="text-slate-900">{form.deliveryMethod === 'DELIVERY' && !quoteValid ? 'Chưa có báo giá' : formatCurrency(deliveryFee)}</strong></div>
              <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-200 pt-4"><span className="font-bold text-slate-800">Tổng thanh toán</span><strong className="text-2xl font-black text-emerald-700">{formatCurrency(totalAmount)}</strong></div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              <Clock3 size={18} className="shrink-0" />
              Giữ sản phẩm trong {preview.reservationMinutes} phút
            </div>
            {submitError && <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert"><AlertCircle size={18} className="shrink-0" /> {submitError}</div>}

            <div className="mt-6 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
              <button type="button" onClick={goBack} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">Quay lại</button>
              <button type="submit" disabled={!canSubmit} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300">
                {submitting ? <LoaderCircle size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                {submitting ? 'Đang gửi đơn...' : 'Đặt hàng và giữ món'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default OrderCreatePage
