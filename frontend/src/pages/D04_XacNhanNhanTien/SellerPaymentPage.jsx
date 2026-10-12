import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import Footer from '../../components/Footer'
import PaymentDecisionDialog from '../../components/D04_XacNhanNhanTien/PaymentDecisionDialog'
import { Card, ErrorState, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { ORDER_STATUS } from '../../lib/labels'
import { getSellerPayment, decideSellerPayment } from '../../services/D04_XacNhanNhanTien/confirmationApi'

const labels = { REPORTED: 'Chờ người bán đối chiếu', REJECTED: 'Người bán chưa nhận được tiền', CONFIRMED: 'Đã xác nhận nhận đủ tiền', WAITING: 'Người mua chưa báo chuyển tiền' }
const money = value => {
  const [whole, fraction = '00'] = String(value ?? '0').split('.')
  return `${BigInt(whole).toLocaleString('vi-VN')}${fraction !== '00' ? `,${fraction.padEnd(2, '0')}` : ''} ₫`
}
const safeProof = value => typeof value === 'string' && (/^\/(?!\/)[^\s]+$/.test(value) || /^https?:\/\/[^\s]+$/i.test(value)) ? value : null

function PaymentDetail({ orderId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [note, setNote] = useState('')
  const [decision, setDecision] = useState(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    getSellerPayment(orderId, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setLoadError(''); setLoading(false) }
    }).catch(err => {
      if (!controller.signal.aborted) { setLoadError(errorMessage(err)); setLoading(false) }
    })
    return () => controller.abort()
  }, [orderId, reload])

  const refresh = () => {
    if (lock.current) return
    setDecision(null); setLoading(true); setLoadError(''); setError(''); setReload(value => value + 1)
  }
  const submit = async () => {
    if (lock.current || !decision || !data?.policy.canDecide) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await decideSellerPayment(orderId, decision)
      if (!alive.current) return
      setData(result.data); setNotice(result.message); setNote('')
      // Đọc DB lại; lỗi GET sau commit không được biến thao tác thành "chưa lưu".
      try { const fresh = await getSellerPayment(orderId); if (alive.current) setData(fresh) }
      catch { if (alive.current) setError('Đã lưu kết quả. Chưa tải lại được dữ liệu; vui lòng tải lại.') }
    } catch (err) {
      if (!alive.current) return
      const message = errorMessage(err)
      try {
        const fresh = await getSellerPayment(orderId)
        if (!alive.current) return
        setData(fresh)
        const expected = decision.action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED'
        if (fresh.paymentStatus === expected && fresh.lastDecision?.reportVersion === decision.reportVersion
            && fresh.lastDecision?.action === decision.action && fresh.lastDecision?.note === decision.note) {
          setNotice('Trạng thái thanh toán đã được cập nhật trước đó.'); setNote('')
        } else setError(`${message} Đã tải trạng thái mới nhất; hãy đối chiếu lại trước khi quyết định.`)
      } catch { if (alive.current) setError(`${message} Chưa kiểm tra được kết quả đã lưu. Hãy tải lại; không tự gửi lại khi chưa kiểm tra.`) }
    } finally {
      lock.current = false
      if (alive.current) { setBusy(false); setDecision(null) }
    }
  }
  const openDecision = action => {
    if (!busy && data?.policy.canDecide) setDecision({ action, reportVersion: data.reportVersion, note: note.trim() })
  }
  if (loading) return <Loading />
  if (loadError || !data) return <ErrorState message={loadError || 'Không tìm thấy giao dịch.'} onRetry={refresh} />
  const proof = safeProof(data.proofUrl)
  return <>
    <PageHeader code="D04" title={`Xác nhận nhận tiền · Đơn #${data.orderId}`} description={labels[data.paymentStatus] || 'Chưa có thanh toán'} actions={<>
      <Link className={btn.secondary} to="/seller/payments">Danh sách giao dịch</Link>
      <button className={btn.secondary} type="button" disabled={busy} onClick={refresh}><RefreshCw size={16} /> Tải lại</button>
    </>} />
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Thông tin đối chiếu</h2>
        <dl className="mt-4 space-y-4 text-sm text-slate-700">
          <div><dt className="text-slate-500">Sản phẩm</dt><dd className="mt-1 font-semibold">{data.title || `#${data.listingId}`}</dd></div>
          <div><dt className="text-slate-500">Người mua</dt><dd className="mt-1 font-semibold">{data.buyer.name || 'Người mua'} · #{data.buyer.userId}</dd></div>
          <div><dt className="text-slate-500">Tiền sản phẩm người bán phải nhận</dt><dd className="mt-1 text-2xl font-extrabold text-emerald-700">{money(data.productAmount)}</dd></div>
          <div><dt className="text-slate-500">Phí giao hàng (riêng, không cộng vào tiền nhận của người bán)</dt><dd className="mt-1 font-semibold">{money(data.deliveryFee)}</dd></div>
          <div><dt className="text-slate-500">Số tiền trong giao dịch</dt><dd className="mt-1 font-semibold">{data.paymentAmount === null ? 'Chưa có' : money(data.paymentAmount)}</dd></div>
          <div><dt className="text-slate-500">Ngân hàng nhận tiền — snapshot D03</dt><dd className="mt-1 break-all font-semibold">{data.bank?.bankName || 'Chưa lưu'}<br />{data.bank?.accountNumber || 'Chưa lưu'}<br />{data.bank?.accountHolder || 'Chưa lưu'}</dd></div>
          <div><dt className="text-slate-500">Nội dung chuyển khoản</dt><dd className="mt-1 break-all font-semibold">{data.transferContent || 'Chưa có'}</dd></div>
          <div><dt className="text-slate-500">Người mua báo chuyển tiền lúc</dt><dd className="mt-1 font-semibold">{formatDateTime(data.reportedAt)}</dd></div>
          <div><dt className="text-slate-500">Trạng thái đơn</dt><dd className="mt-1 font-semibold">{ORDER_STATUS[data.orderStatus] || data.orderStatus}</dd></div>
        </dl>
      </Card>
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Biên lai người mua gửi</h2>
        {proof ? <a href={proof} target="_blank" rel="noopener noreferrer" className="mt-4 block"><img src={proof} referrerPolicy="no-referrer" alt="Biên lai chuyển khoản đang đối chiếu" className="h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" /><span className="mt-2 block text-xs text-emerald-700">Mở biên lai để xem rõ hơn</span></a> : <p className="mt-4 rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Chưa có biên lai hợp lệ.</p>}
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-600"><ShieldCheck size={20} className="shrink-0 text-emerald-600" />Kiểm tra ứng dụng ngân hàng trước khi quyết định. Ảnh biên lai không tự chứng minh đã nhận tiền.</p>
        <p className="mt-4 text-sm font-medium text-slate-700">{data.policy.message}</p>
        {data.lastDecision && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p>Kết quả đối chiếu gần nhất: {data.lastDecision.action === 'CONFIRM' ? 'Đã nhận đủ tiền' : 'Chưa nhận được tiền'} · #{data.lastDecision.userId} · {formatDateTime(data.lastDecision.at)}</p><p className="mt-2 whitespace-pre-wrap break-words">Ghi chú: {data.lastDecision.note || 'Không có'}</p></div>}
        <label className="mt-5 block text-sm font-semibold text-slate-700">Ghi chú đối chiếu (tối đa 250 ký tự)
          <textarea aria-label="Ghi chú đối chiếu" maxLength={250} rows={3} className={`${input} mt-2`} value={note} onChange={event => setNote(event.target.value)} disabled={busy || !data.policy.canDecide} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className={btn.primary} type="button" disabled={busy || !data.policy.canDecide} onClick={() => openDecision('CONFIRM')}>Đã nhận đủ tiền</button>
          <button className={btn.secondary} type="button" disabled={busy || !data.policy.canDecide} onClick={() => openDecision('REJECT')}>Chưa nhận được tiền</button>
        </div>
      </Card>
    </div>
    <PaymentDecisionDialog action={decision?.action} orderId={data.orderId} busy={busy} onClose={() => setDecision(null)} onSubmit={submit} />
    <div className="mt-8"><Footer /></div>
  </>
}

export default function SellerPaymentPage() {
  const { orderId } = useParams()
  return <PaymentDetail key={orderId} orderId={orderId} />
}
