import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, PageHeader } from '../../components/D05_TheoDoiDonHang/OrderUi'
import { btn, input } from '../../components/admin/styles'
import CompletionProof from '../../components/D13_XacThucGiaoHangOTP/CompletionProof'
import { errorMessage } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { formatDateTime } from '../../lib/format'
import { getCompletionPreview, completeDelivery, validateCompletionImage } from '../../services/D13_XacThucGiaoHangOTP/completionApi'

function CompleteContent({ deliveryId }) {
  const location = useLocation(), pending = useRef(null), lock = useRef(false), generation = useRef(0)
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [unauthorized, setUnauthorized] = useState(false), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  const [code, setCode] = useState(''), [checked, setChecked] = useState(false), [file, setFile] = useState(null), [preview, setPreview] = useState(null)
  const [uncertain, setUncertain] = useState(false)
  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    queueMicrotask(() => setPreview(url))
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    let controller, disposed = false
    async function load() {
      if (lock.current) return
      controller?.abort(); controller = new AbortController(); const current = generation.current
      try {
        const next = await getCompletionPreview(deliveryId, controller.signal)
        if (disposed || controller.signal.aborted || current !== generation.current) return
        setData(next)
        if (next.verified) {
          setCode(''); setFile(null); setPreview(null); setChecked(false)
          // Khi phản hồi PATCH bị mất, giữ khóa để người dùng kiểm tra lại kết quả commit.
          if (pending.current) pending.current.intent = null
        }
      } catch (e) {
        if (!disposed && !controller.signal.aborted && current === generation.current) {
          setError(errorMessage(e)); setData(null)
          if (e.response?.status === 401) setUnauthorized(true)
        }
      }
    }
    load(); const timer = window.setInterval(load, 5000)
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer) }
  }, [deliveryId, reload])
  if (!getAccessToken({ sessionOnly: true }) || unauthorized) return <Navigate replace to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} state={{ from: location }} />
  async function send(retry = false) {
    if (lock.current) return
    if (!retry) {
      if (!/^\d{6}$/.test(code)) { setError('Vui lòng nhập mã giao hàng gồm đúng 6 chữ số.'); return }
      if (!file) { setError('Vui lòng đính kèm ảnh bàn giao JPG hoặc PNG.'); return }
      const invalid = validateCompletionImage(file)
      if (invalid) { setError(invalid); return }
      if (!checked) { setError('Vui lòng xác nhận đã bàn giao kiện hàng thực tế.'); return }
      if (!data?.canComplete) { setError(data?.code.policy.message || data?.policy.message || 'Chuyến chưa đủ điều kiện xác thực.'); return }
      pending.current = { key: crypto.randomUUID(), intent: { completionCode: code, codeSession: data.code.session, handoverConfirmed: true, file } }
    }
    const request = pending.current
    if (!request) return
    lock.current = true; generation.current++; setBusy(true); setError(''); setNotice('')
    try {
      const result = await completeDelivery(deliveryId, request.intent, request.key)
      setData(result.data); setNotice(result.message); setUncertain(false); pending.current = null
      setCode(''); setChecked(false); setFile(null); setPreview(null)
    } catch (e) {
      setError(errorMessage(e, 'Chưa nhận được phản hồi. Tải lại trạng thái hoặc thử lại cùng yêu cầu.'))
      const unknown = !e.response || e.response.status >= 500
      setUncertain(unknown)
      if (!unknown) pending.current = null
      if (e.response?.status === 401) setUnauthorized(true)
    } finally { lock.current = false; setBusy(false); setReload(n => n + 1) }
  }
  return <>
    <PageHeader code="D13" title="Xác thực giao hàng" actions={<><Link to={data?.trackingUrl || '/driver/deliveries'} className={btn.secondary}>Theo dõi đơn/chuyến</Link><button className={btn.secondary} disabled={busy} onClick={() => setReload(n => n + 1)}>Tải lại trạng thái</button></>} />
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-green-50 p-4">{notice}</p>}
    {uncertain && <Card className="mb-4 space-y-3 p-5"><p>Chưa xác định được kết quả phản hồi. Thử lại cùng yêu cầu sẽ không ghi nhận giao hàng hai lần.</p><button className={btn.primary} disabled={busy} onClick={() => send(true)}>Thử lại cùng yêu cầu</button></Card>}
    {data ? <Card className="space-y-4 p-5">
      <h2 className="text-lg font-bold">Chuyến #{data.deliveryId} · Đơn #{data.orderId}</h2>
      <p>Chuyến: {data.deliveryStatus} · Đơn: {data.orderStatus}</p>
      {data.verified ? <><p role="status">Đã xác thực và giao hàng thành công lúc {formatDateTime(data.verifiedAt)}. Chờ người mua xác nhận nhận hàng; đây chưa phải hoàn tất đơn.</p><CompletionProof orderId={data.orderId} deliveryId={data.deliveryId} /></> : <>
        <p className="text-amber-800">{data.policy.allowed ? data.code.policy.message : data.policy.message}</p>
        <p>Chỉ người mua tạo mã tại trang theo dõi đơn. Nhận mã khi bàn giao thực tế. Không dùng mã lấy hàng D08.</p>
        <p>Lượt nhập còn lại: {data.code.attemptsRemaining}{data.code.expiresAt ? ` · Hạn mã: ${formatDateTime(data.code.expiresAt)}` : ''}</p>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); send() }}>
          <label className="d-code block font-semibold" htmlFor="completion-code">Mã giao hàng (6 chữ số)<input id="completion-code" className={`${input} mt-2`} type="text" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={busy || uncertain} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="block font-semibold" htmlFor="completion-proof">Ảnh bàn giao (JPG/PNG, tối đa 5 MB)<input id="completion-proof" className="mt-2 block" type="file" accept="image/jpeg,image/png" disabled={busy || uncertain} onChange={e => { const selected = e.target.files?.[0] || null, invalid = validateCompletionImage(selected); setError(invalid || ''); setFile(invalid ? null : selected); setPreview(null) }} /></label>
          {preview && <img className="max-h-72 max-w-full rounded-xl object-contain" src={preview} alt="Ảnh bàn giao chuẩn bị gửi" />}
          <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={busy || uncertain} onChange={e => setChecked(e.target.checked)} />Tôi xác nhận đã bàn giao kiện hàng thực tế cho người mua.</label>
          <button type="submit" className={btn.primary} disabled={busy || uncertain || !data.canComplete}>{busy ? 'Đang xác thực…' : 'Xác nhận giao hàng thành công'}</button>
        </form>
      </>}
    </Card> : !error && <p role="status">Đang tải chuyến giao…</p>}
  </>
}
export default function DeliveryCompletePage() {
  const { deliveryId } = useParams()
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header /><main className="d-workspace mx-auto min-h-[600px] max-w-4xl px-4 py-8"><CompleteContent key={deliveryId} deliveryId={deliveryId} /></main><Footer /></div>
}
