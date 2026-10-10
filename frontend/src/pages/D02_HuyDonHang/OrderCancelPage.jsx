import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CancellationForm from '../../components/D02_HuyDonHang/CancellationForm'
import { errorMessage, getDevUserId } from '../../lib/api'
import { getAccessToken, rememberPostLoginUrl } from '../../lib/auth'
import { isD01DemoEnabled } from '../../lib/d01Demo'
import { ORDER_STATUS } from '../../lib/labels'
import { cancelOrder, getCancellationPreview } from '../../services/D02_HuyDonHang/cancellationApi'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value))
const paymentLabels = { WAITING: 'Chưa báo chuyển tiền', REPORTED: 'Đã báo chuyển tiền, chờ xác minh', CONFIRMED: 'Người bán đã xác nhận nhận tiền', REJECTED: 'Người bán chưa nhận được tiền' }

export default function OrderCancelPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const lock = useRef(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [reload, setReload] = useState(0)

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [orderId])

  const login = useCallback(() => {
    const returnTo = `${location.pathname}${location.search}`
    rememberPostLoginUrl(returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { from: returnTo } })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!getAccessToken() && !getDevUserId() && !isD01DemoEnabled()) { login(); return undefined }
    const controller = new AbortController()
    getCancellationPreview(orderId, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false) }
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err.response?.status === 401) login()
      else { setData(null); setError(errorMessage(err)); setLoading(false) }
    })
    return () => controller.abort()
  }, [orderId, login, reload])

  const refresh = () => { setLoading(true); setError(''); setReload(current => current + 1) }
  const back = () => navigate('/') // D05 chưa có; không quay về success D01 đã cũ.

  const submit = async reason => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await cancelOrder(orderId, reason)
      toast.dismiss(`order-created-${result.data.orderId}`)
      setNotice({ orderId: result.data.orderId, message: result.message })
      setData(result.data)
      // Đọc lại server; không tự suy ra trạng thái từ snapshot D01.
      const fresh = await getCancellationPreview(orderId)
      setData(fresh)
    } catch (err) {
      if (err.response?.status === 401) { login(); return }
      setError(errorMessage(err))
      try { setData(await getCancellationPreview(orderId)) } catch { /* Giữ snapshot và nút tải lại, không giả báo thành công. */ }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  // React Router có thể tái sử dụng component khi đổi :orderId; tuyệt đối không
  // cho biểu mẫu của snapshot đơn cũ gửi thao tác tới mã đơn mới trên URL.
  const currentOrder = data && Number(data.orderId) === Number(orderId)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      {isD01DemoEnabled() && !getAccessToken() && <p role="status" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Chế độ test D01/D02: dùng tài khoản demo của nhóm, vẫn kiểm tra quyền sở hữu đơn.</p>}
      <main className="mx-auto min-h-[600px] max-w-2xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">Hủy đơn hàng</h1>
          {(loading || (!currentOrder && !error)) && <p role="status" className="mt-5 text-sm text-slate-500">Đang tải đơn hàng…</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {notice?.orderId === Number(orderId) && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice.message}</p>}
          {!loading && currentOrder && <>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 border-y border-slate-200 py-5 text-sm">
              <dt>Mã đơn hàng</dt><dd className="text-right font-bold">#{data.orderId}</dd>
              <dt>Sản phẩm</dt><dd className="text-right font-semibold">{data.title || `Tin #${data.listingId}`}</dd>
              <dt>Tiền sản phẩm</dt><dd className="text-right">{money(data.productAmount)}</dd>
              <dt>Phí giao hàng</dt><dd className="text-right">{money(data.deliveryFee)}</dd>
              <dt>Tổng chi phí</dt><dd className="text-right font-bold text-emerald-700">{money(data.totalAmount)}</dd>
              <dt>Trạng thái đơn</dt><dd className="text-right">{ORDER_STATUS[data.status] || data.status}</dd>
              <dt>Thanh toán</dt><dd className="text-right">{paymentLabels[data.paymentStatus] || data.paymentStatus || 'Chưa có thông báo thanh toán'}</dd>
            </dl>
            {data.action === 'CANCEL' && <CancellationForm key={data.orderId} busy={busy} onSubmit={submit} onBack={back} />}
            {data.action === 'CANCELLED' && <div className="mt-5 space-y-3 text-sm">
              <p>Đơn #{data.orderId} đã được hủy.</p>
              <p className="whitespace-pre-wrap break-words text-slate-600">Lý do: {data.cancelReason}</p>
              <p>{data.listingStatus === 'ACTIVE' ? 'Sản phẩm hiện đang mở bán.' : 'Sản phẩm chưa được mở bán lại; trạng thái tin và các quy trình liên quan vẫn được bảo toàn.'}</p>
            </div>}
            {data.action === 'REFUND' && <div className="mt-5 space-y-4 text-sm">
              <p>{data.message}</p>
              <p className="text-slate-600">Mở biểu mẫu không hủy đơn hoặc xác nhận hoàn tiền. B06–B07 chỉ cập nhật trạng thái sau khi nhận yêu cầu hợp lệ.</p>
              {isD01DemoEnabled() && !getAccessToken() && <p className="text-amber-800">Luồng hoàn tiền giữ cơ chế tài khoản của thành viên B; tài khoản demo D01/D02 không được cấp quyền truy cập API hoàn tiền.</p>}
              <Link to={data.refundUrl} className="inline-block rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Tạo yêu cầu hoàn tiền</Link>
            </div>}
            {['BLOCKED', 'VERIFY_PAYMENT'].includes(data.action) && <div className="mt-5 space-y-2 text-sm"><p>{data.message}</p>{data.detail && <p className="text-slate-600">{data.detail}</p>}</div>}
          </>}
          {!loading && (!data || data.action !== 'CANCEL') && <button type="button" onClick={back} className="mt-6 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Quay lại trang chủ</button>}
          <button type="button" disabled={busy} onClick={refresh} className="ml-3 mt-6 text-sm font-bold text-emerald-700 disabled:opacity-50">Tải lại trạng thái</button>
        </section>
      </main>
      <Footer />
    </div>
  )
}
