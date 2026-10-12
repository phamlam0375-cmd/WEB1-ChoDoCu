import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Copy, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import ReceiptUpload from '../../components/D03_ThanhToan/ReceiptUpload'
import { errorMessage, getDevUserId } from '../../lib/api'
import { getAccessToken, rememberPostLoginUrl } from '../../lib/auth'
import { isD01DemoEnabled } from '../../lib/d01Demo'
import { ORDER_STATUS } from '../../lib/labels'
import { getPaymentInfo, reportPayment } from '../../services/D03_ThanhToan/paymentApi'

const paymentLabels = { WAITING: 'Chưa báo chuyển tiền', REPORTED: 'Đã báo chuyển tiền — chờ người bán xác nhận', CONFIRMED: 'Người bán đã xác nhận nhận tiền', REJECTED: 'Người bán chưa nhận được tiền' }
// Không ép DECIMAL lớn qua Number: giữ chính xác cả phần lẻ khi hiển thị tiền.
const money = value => {
  const [whole, fraction = '00'] = String(value ?? '0').split('.')
  return `${BigInt(whole).toLocaleString('vi-VN')}${fraction !== '00' ? `,${fraction.padEnd(2, '0')}` : ''} ₫`
}

function CopyField({ label, value, onCopy }) {
  return <div className="mt-4">
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 flex items-center justify-between gap-3 break-all text-sm font-bold">
      <span>{value || 'Chưa cập nhật'}</span>
      {value && <button type="button" onClick={() => onCopy(value, label)} aria-label={`Sao chép ${label.toLowerCase()}`} className="shrink-0 rounded-lg border border-slate-200 p-2 text-emerald-700 hover:bg-emerald-50"><Copy size={16} /></button>}
    </dd>
  </div>
}

export default function OrderPaymentPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const lock = useRef(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [proof, setProof] = useState(null)
  const [notice, setNotice] = useState(null)

  useLayoutEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0 }, [orderId])

  const login = useCallback(() => {
    const returnTo = `${location.pathname}${location.search}`
    rememberPostLoginUrl(returnTo)
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { from: returnTo } })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!getAccessToken() && !getDevUserId() && !isD01DemoEnabled()) { login(); return undefined }
    const controller = new AbortController()
    getPaymentInfo(orderId, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false) }
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err.response?.status === 401) login()
      else { setData(null); setError(errorMessage(err)); setLoading(false) }
    })
    return () => controller.abort()
  }, [orderId, reload, login])

  const refresh = () => { setLoading(true); setError(''); setReload(value => value + 1) }
  const currentOrder = data && Number(data.orderId) === Number(orderId)

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value))
      toast.success(label === 'Nội dung chuyển khoản' ? 'Đã sao chép nội dung chuyển khoản.' : `Đã sao chép ${label.toLowerCase()}.`)
    } catch { toast.error('Không thể sao chép. Vui lòng chọn và sao chép thông tin thủ công.') }
  }

  const submit = async event => {
    event.preventDefault()
    if (lock.current || !currentOrder || !data.policy.canReport) return
    if (proof?.orderId !== orderId || !proof.file) { setError('Vui lòng tải ảnh biên lai chuyển khoản.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await reportPayment(orderId, proof.file, data.productAmount)
      setData(result.data)
      setProof(null)
      setNotice({ orderId, message: result.message })
      toast.dismiss(`order-created-${result.data.orderId}`)
      // Sau POST thành công, UI đã đọc trạng thái DB từ response. Lỗi reload
      // không biến thông báo đã gửi thành thất bại và không tự gửi lại.
      try { setData(await getPaymentInfo(orderId)) } catch { setError('Đã ghi nhận thông báo. Chưa tải lại được trạng thái; vui lòng thử tải lại.') }
    } catch (err) {
      if (err.response?.status === 401) { login(); return }
      setError(errorMessage(err))
      try { setData(await getPaymentInfo(orderId)) } catch { /* Giữ nút tải lại khi mất mạng. */ }
    } finally { lock.current = false; setBusy(false) }
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    {isD01DemoEnabled() && !getAccessToken() && <p role="status" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Chế độ test D01/D02/D03: dùng tài khoản demo của nhóm, vẫn kiểm tra quyền sở hữu đơn.</p>}
    <main className="mx-auto min-h-[620px] max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black sm:text-3xl">Thanh toán cho người bán</h1>
      <p className="mt-2 text-sm text-slate-500">Chuyển khoản trực tiếp; website không giữ tiền hoặc tự xác nhận giao dịch ngân hàng.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {notice?.orderId === orderId && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice.message}</p>}
      {(loading || !currentOrder && !error) && <p role="status" className="mt-8">Đang tải thông tin thanh toán…</p>}
      {!loading && currentOrder && <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="border-b border-slate-200 pb-3 text-lg font-black">Thông tin đơn hàng</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt>Mã đơn</dt><dd className="font-bold">#{data.orderId}</dd></div>
              <div className="flex justify-between gap-4"><dt>Sản phẩm</dt><dd className="text-right font-bold">{data.title || `Tin #${data.listingId}`}</dd></div>
              <div className="flex justify-between gap-4"><dt>Người bán</dt><dd className="text-right">{data.seller.name}</dd></div>
              <div className="flex justify-between gap-4"><dt>Trạng thái đơn</dt><dd className="text-right">{ORDER_STATUS[data.status] || data.status}</dd></div>
              <div className="flex justify-between gap-4"><dt>Thanh toán</dt><dd className="text-right font-bold">{paymentLabels[data.paymentStatus] || 'Chưa có giao dịch'}</dd></div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-4"><dt>Tiền sản phẩm</dt><dd className="font-bold text-emerald-700">{money(data.productAmount)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Phí giao hàng (trả tài xế)</dt><dd>{money(data.deliveryFee)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Tổng chi phí</dt><dd>{money(data.totalAmount)}</dd></div>
            </dl>
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm">
              <p className="font-bold">Chỉ chuyển cho người bán: {money(data.sellerAmount)}</p>
              <p className="mt-1 text-emerald-900">Không cộng phí giao hàng; D03 không thu phí hoặc hoa hồng cho website.</p>
            </div>
            <dl><CopyField label="Nội dung chuyển khoản" value={data.transferContent} onCopy={copy} /></dl>
            <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm">{data.policy.message}</p>
          </section>
          <section>
            <h2 className="border-b border-slate-200 pb-3 text-lg font-black">Thông tin nhận tiền</h2>
            <div aria-label="Khu vực QR người bán" className="mt-5 flex min-h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-sm text-slate-500">Mã QR của người bán sẽ được cập nhật sau.</div>
            <dl>
              <CopyField label="Ngân hàng" value={data.bank?.bankName} onCopy={copy} />
              <CopyField label="Số tài khoản" value={data.bank?.accountNumber} onCopy={copy} />
              <CopyField label="Chủ tài khoản" value={data.bank?.accountHolder} onCopy={copy} />
            </dl>
            {!data.bank && <p className="mt-4 text-sm text-amber-800">Người bán chưa cập nhật thông tin nhận tiền.</p>}
            {data.policy.canReport && <ReceiptUpload key={orderId} disabled={busy} onChange={file => setProof({ orderId, file })} />}
            {data.proofUrl && <p className="mt-5 text-sm"><a href={data.proofUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline">Xem biên lai đã gửi</a>{data.reportedAt && <span className="mt-1 block text-xs text-slate-500">Báo lúc {new Date(data.reportedAt).toLocaleString('vi-VN')}</span>}</p>}
          </section>
        </div>
        <p className="mt-7 flex items-start gap-2 border-t border-slate-200 pt-5 text-sm text-slate-600"><ShieldCheck size={18} className="shrink-0 text-emerald-600" /> Chỉ báo sau khi đã chuyển tiền. Người bán sẽ kiểm tra ngân hàng và xác nhận ở D04.</p>
        <button type="submit" disabled={busy || !data.policy.canReport} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy && <LoaderCircle size={18} className="animate-spin" />}{busy ? 'Đang gửi…' : 'Tôi đã chuyển tiền'}</button>
        <Link to={data.cancelUrl} className="mt-3 block rounded-xl border border-slate-300 p-3 text-center text-sm font-bold">Quay lại đơn hàng / Hủy đơn</Link>
      </form>}
      <div className="mt-5 flex items-center justify-between gap-4 text-sm font-bold">
        <Link to="/" className="text-slate-600">Về trang chủ</Link>
        <button type="button" disabled={busy || loading && currentOrder} onClick={refresh} className="flex items-center gap-2 text-emerald-700 disabled:opacity-50"><RefreshCw size={16} /> Tải lại trạng thái</button>
      </div>
    </main>
    <Footer />
  </div>
}
