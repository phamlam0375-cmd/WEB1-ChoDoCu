import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, PageHeader } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { errorMessage } from '../../lib/api'
import { clearSession, getAccessToken, rememberPostLoginUrl } from '../../lib/auth'
import { formatDateTime, formatDecimalMoney } from '../../lib/format'
import { ORDER_STATUS, DELIVERY_STATUS } from '../../lib/labels'
import { confirmReceipt, getReceiptPreview } from '../../services/D06_XacNhanNhanHang/receiptApi'

function ReceiptDetail({ orderId }) {
  const location = useLocation()
  const navigate = useNavigate()
  const lock = useRef(false)
  const alive = useRef(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const login = useCallback((expiredToken) => {
    if (expiredToken && !clearSession(expiredToken)) return
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    rememberPostLoginUrl(returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { from: returnTo } })
  }, [location.pathname, location.search, location.hash, navigate])

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const token = getAccessToken()
    if (!token) { login(); return undefined }
    const controller = new AbortController()
    getReceiptPreview(orderId, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false) }
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err.response?.status === 401) login(token)
      else { setError(errorMessage(err)); setLoading(false) }
    })
    return () => controller.abort()
  }, [orderId, reload, login])

  const submit = async event => {
    event.preventDefault()
    if (lock.current || !data?.policy.canConfirm) return
    if (!checked) { setError('Vui lòng xác nhận bạn đã nhận sản phẩm.'); return }
    const token = getAccessToken()
    if (!token) { login(); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await confirmReceipt(orderId, checked)
      if (!alive.current) return
      setData(result.data); setChecked(false); setNotice(result.message)
      toast.success(result.message)
      // PATCH đã commit: lỗi tải lại không được báo rằng hoàn tất thất bại.
      try {
        const fresh = await getReceiptPreview(orderId)
        if (alive.current) setData(fresh)
      } catch {
        if (alive.current) setError('Đã ghi nhận xác nhận. Chưa tải lại được trạng thái; vui lòng tải lại.')
      }
    } catch (err) {
      if (!alive.current) return
      if (err.response?.status === 401) { login(token); return }
      setError(errorMessage(err))
      try { const fresh = await getReceiptPreview(orderId); if (alive.current) setData(fresh) } catch { /* Có nút tải lại, không tự gửi lại PATCH. */ }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  const refresh = () => { setLoading(true); setReload(value => value + 1) }
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    <main className="mx-auto min-h-[600px] max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader title="Xác nhận đã nhận hàng" description="Chỉ xác nhận sau khi bạn đã nhận và kiểm tra sản phẩm. Thao tác này hoàn tất đơn hàng, không chuyển tiền." />
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
      {loading ? <p role="status">Đang tải thông tin nhận hàng…</p> : data && <Card className="p-5 sm:p-8">
        <h2 className="text-xl font-bold">Đơn #{data.orderId} · {data.product.title || `Tin #${data.product.listingId}`}</h2>
        <dl className="my-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Trạng thái đơn</dt><dd className="font-bold">{ORDER_STATUS[data.orderStatus] || data.orderStatus}</dd></div>
          <div><dt className="text-slate-500">Hình thức nhận</dt><dd>{data.deliveryMethod === 'PICKUP' ? 'Tự đến lấy' : 'Giao tận nơi'}</dd></div>
          <div><dt className="text-slate-500">Tiền sản phẩm</dt><dd>{formatDecimalMoney(data.productAmount)}</dd></div>
          <div><dt className="text-slate-500">Phí giao hàng (không tính hoa hồng)</dt><dd>{formatDecimalMoney(data.deliveryFee)}</dd></div>
          {data.deliveries.map(d => <div key={d.deliveryId}><dt className="text-slate-500">Chuyến #{d.deliveryId}</dt><dd>{DELIVERY_STATUS[d.status] || d.status}</dd><dd>Xác thực giao hàng: {formatDateTime(d.verifiedAt)}</dd></div>)}
          {data.completedAt && <div><dt className="text-slate-500">Hoàn tất lúc</dt><dd data-testid="completed-at">{formatDateTime(data.completedAt)}</dd></div>}
        </dl>
        {!data.policy.canConfirm && <p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{data.policy.reason}</p>}
        <form onSubmit={submit}>
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-emerald-600" checked={checked} disabled={busy || !data.policy.canConfirm} onChange={event => setChecked(event.target.checked)} />
            Tôi đã nhận được sản phẩm
          </label>
          <button type="submit" disabled={busy || !checked || !data.policy.canConfirm} className={`${btn.primary} mt-5 min-h-12 w-full`}>{busy ? 'Đang xác nhận…' : 'Xác nhận hoàn tất'}</button>
        </form>
        {data.capabilities.refund.enabled ? <Link to={data.capabilities.refund.href} state={{ receiptRefundFrom: String(data.orderId) }} className={`${btn.secondary} mt-4 w-full`}>Sản phẩm có vấn đề / Yêu cầu hoàn tiền</Link> : <p className="mt-4 text-sm text-slate-500">Yêu cầu hoàn tiền: {data.capabilities.refund.reason}</p>}
        {data.orderStatus === 'COMPLETED' && (data.capabilities.review.enabled ? <Link to={data.capabilities.review.href} className={`${btn.secondary} mt-4`}>Đánh giá giao dịch</Link> : <p className="mt-4 text-sm text-slate-500">{data.capabilities.review.reason}</p>)}
      </Card>}
      <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm font-bold text-emerald-700">
        <Link to={`/orders/${orderId}/tracking`}>Theo dõi đơn hàng</Link>
        <button type="button" onClick={refresh} disabled={busy || loading}>Tải lại trạng thái</button>
      </div>
    </main>
    <Footer />
  </div>
}
export default function OrderReceivedPage() {
  const { orderId } = useParams()
  return <ReceiptDetail key={orderId} orderId={orderId} />
}
