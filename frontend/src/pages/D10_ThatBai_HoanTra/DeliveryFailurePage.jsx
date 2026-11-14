import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, ConfirmDialog, ErrorState, Loading, PageHeader } from '../../components/D05_TheoDoiDonHang/OrderUi'
import { btn, input } from '../../components/admin/styles'
import { getAccessToken } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { DELIVERY_STATUS, ORDER_STATUS } from '../../lib/labels'
import { getFailurePreview, updateFailure, retryDateToISO } from '../../services/D10_ThatBai_HoanTra/failureApi'

const reasons = { UNAVAILABLE: 'Không liên hệ được người nhận', ADDRESS: 'Địa chỉ giao hàng không phù hợp', REFUSED: 'Người nhận từ chối nhận', PACKAGE: 'Sự cố kiện hàng', OTHER: 'Lý do khác' }
function FailureContent({ id }) {
  const location = useLocation(), generation = useRef(0), lock = useRef(false)
  const [revision, setRevision] = useState(0), [resource, setResource] = useState({ loading: true, data: null, error: '', unauthorized: false })
  const [form, setForm] = useState({ reasonCode: '', note: '', scheduledAt: '', recipientName: '', handoverConfirmed: false })
  const [pending, setPending] = useState(null), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState('')
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const refresh = () => { generation.current++; setRevision(n => n + 1) }
  useEffect(() => {
    const controller = new AbortController(), current = ++generation.current
    async function load() {
      setResource(previous => ({ ...previous, loading: true, error: '' }))
      try {
        const data = await getFailurePreview(id, { signal: controller.signal })
        if (!controller.signal.aborted && current === generation.current) setResource({ loading: false, data, error: '', unauthorized: false })
      } catch (e) {
        if (!controller.signal.aborted && current === generation.current) setResource(previous => ({ ...previous, loading: false, error: errorMessage(e), unauthorized: e.response?.status === 401 }))
      }
    }
    load(); return () => controller.abort()
  }, [id, revision])
  const { data, loading } = resource
  if (!getAccessToken({ sessionOnly: true }) || resource.unauthorized) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace state={{ from: location }} />
  const change = patch => setForm(previous => ({ ...previous, ...patch }))
  async function send(action, retry = false) {
    if (lock.current || loading || !data) return
    let request = pending
    if (!retry) {
      if (action === 'FAIL' && !form.reasonCode) { setError('Vui lòng chọn lý do giao không thành công.'); return }
      if (action === 'FAIL' && form.reasonCode === 'OTHER' && !form.note.trim()) { setError('Vui lòng mô tả lý do khác.'); return }
      if (action === 'CONFIRM_RETURN' && (!form.recipientName.trim() || !form.handoverConfirmed)) { setError('Vui lòng nhập người nhận và xác nhận đã bàn giao trả hàng thực tế.'); return }
      let scheduledAt
      try { if (action === 'SCHEDULE') scheduledAt = retryDateToISO(form.scheduledAt) }
      catch (e) { setError(e.message); return }
      const payload = { action, note: form.note.trim(), ...(action === 'FAIL' ? { reasonCode: form.reasonCode } : {}), ...(action === 'SCHEDULE' ? { scheduledAt } : {}), ...(action === 'CONFIRM_RETURN' ? { recipientName: form.recipientName.trim(), handoverConfirmed: true } : {}) }
      const signature = JSON.stringify(payload)
      request = pending?.signature === signature ? pending : { payload, signature, key: crypto.randomUUID(), version: data.version }
      setPending(request)
    }
    if (!request) return
    lock.current = true; generation.current++; setBusy(true); setError(''); setNotice('')
    try {
      const result = await updateFailure(id, request.payload, request.key, request.version)
      setResource(previous => ({ ...previous, data: result.data })); setPending(null); setConfirm(''); setNotice(result.message)
      setForm(previous => ({ ...previous, note: '', reasonCode: '', handoverConfirmed: false }))
    } catch (e) {
      setConfirm('') // Không để hộp xác nhận che lỗi hoặc nút retry cùng khóa.
      setError(errorMessage(e, 'Chưa nhận được phản hồi. Hãy tải lại kiểm tra; có thể thử lại đúng thao tác đang chờ, không tự tạo yêu cầu khác.'))
      if (e.response?.status === 401) setResource(previous => ({ ...previous, unauthorized: true }))
      if (e.response && e.response.status < 500 && e.response.status !== 401) setPending(null)
    } finally { lock.current = false; setBusy(false); refresh() }
  }
  return <>
    <PageHeader code="D10" title="Giao thất bại và chuyển hoàn" actions={<>
      <Link className={btn.secondary} to={data?.trackingUrl || '/driver/deliveries'}>Theo dõi đơn/chuyến</Link>
      <button className={btn.secondary} disabled={busy || loading} type="button" onClick={refresh}>Tải lại</button>
    </>} />
    {notice && <p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-green-900">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {pending && error && <button className={`${btn.secondary} mb-4`} type="button" disabled={busy || loading} onClick={() => send(pending.payload.action, true)}>Thử lại đúng thao tác đang chờ</button>}
    {loading && !data ? <Loading /> : resource.error ? <ErrorState message={resource.error} onRetry={refresh} /> : data && <>
      <Card className="mb-5 space-y-3 break-words p-5">
        <h2 className="text-lg font-bold">Chuyến #{data.deliveryId} · Đơn #{data.orderId}</h2>
        <p>Trạng thái chuyến: <strong>{DELIVERY_STATUS[data.deliveryStatus] || data.deliveryStatus}</strong></p>
        <p>Trạng thái đơn: {ORDER_STATUS[data.orderStatus] || data.orderStatus}</p>
        <p>Sản phẩm: {data.product.title || `Tin #${data.product.listingId}`}</p>
        <p>Lấy tại: {data.pickupAddress}</p><p>Giao tại: {data.deliveryAddress}</p>
        <p>Số lần thất bại đã ghi nhận: <strong>{data.failureCount}</strong> · Số lần thực sự bắt đầu giao lại: <strong>{data.retryCount}</strong></p>
        {data.failureReason && <p className="whitespace-pre-wrap text-rose-700">Lý do: {data.failureReason}</p>}
        {data.scheduledAt && <p>Lịch giao lại đã lưu: <strong>{formatDateTime(data.scheduledAt)}</strong>. Tới giờ không tự bắt đầu; tải lại rồi chủ động bấm bắt đầu.</p>}
        {data.returnedAt && <p>Đã trả hàng: {formatDateTime(data.returnedAt)}</p>}
        {data.handover && <p className="whitespace-pre-wrap">Người nhận kiện trả: {data.handover.recipientName} · {data.handover.note}</p>}
        <p className="text-sm text-amber-800">{data.refund.message}</p>
        <Link className={btn.secondary} to={data.trackingUrl}>Xem lịch sử D05</Link>
        {data.deliveryStatus === 'DELIVERING' && <Link className={`${btn.secondary} ml-2`} to={data.progressUrl}>Ghi chú tiến độ D09</Link>}
      </Card>
      {['DELIVERING', 'FAILED', 'RETURNING'].includes(data.deliveryStatus) && <Card className="space-y-4 p-5">
        <label className="block text-sm font-semibold" htmlFor="failure-note">Ghi chú / mô tả sự việc<textarea id="failure-note" className={`${input} mt-2 min-h-28`} value={form.note} maxLength={500} disabled={busy} onChange={e => change({ note: e.target.value })} /></label>
        <p className="text-sm text-slate-500">{[...form.note].length}/500 ký tự. Không nhập mã xác thực hoặc thông tin bí mật. D10 không thay đổi phí và không bắt buộc thêm ảnh.</p>
        {data.deliveryStatus === 'DELIVERING' && <form onSubmit={e => { e.preventDefault(); send('FAIL') }} className="space-y-4">
          <label className="block text-sm font-semibold" htmlFor="failure-reason">Lý do giao không thành công<select id="failure-reason" className={`${input} mt-2`} value={form.reasonCode} disabled={busy} onChange={e => change({ reasonCode: e.target.value })}><option value="">Chọn lý do</option>{Object.entries(reasons).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
          {!data.actions.FAIL.allowed && <p className="text-amber-800">{data.actions.FAIL.message}</p>}
          <button className={btn.primary} type="submit" disabled={busy || loading || !data.actions.FAIL.allowed}>Ghi nhận giao thất bại</button>
        </form>}
        {data.deliveryStatus === 'FAILED' && <>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); send('SCHEDULE') }}>
            <label className="block text-sm font-semibold" htmlFor="retry-schedule">Lịch giao lại ({Intl.DateTimeFormat().resolvedOptions().timeZone})<input id="retry-schedule" type="datetime-local" step="1" value={form.scheduledAt} disabled={busy} className={`${input} mt-2`} onChange={e => change({ scheduledAt: e.target.value })} /></label>
            {!data.actions.SCHEDULE.allowed && <p className="text-amber-800">{data.actions.SCHEDULE.message}</p>}
            <button type="submit" className={btn.secondary} disabled={busy || loading || !data.actions.SCHEDULE.allowed}>Hẹn giao lại</button>
          </form>
          <button type="button" className={btn.primary} disabled={busy || loading || !data.actions.RETRY.allowed} onClick={() => send('RETRY')}>Bắt đầu giao lại</button>
          {!data.actions.RETRY.allowed && <p className="text-sm text-amber-800">{data.actions.RETRY.message}</p>}
          <button type="button" className={btn.danger} disabled={busy || loading || !data.actions.START_RETURN.allowed} onClick={() => setConfirm('START_RETURN')}>Chuyển hoàn</button>
        </>}
        {data.deliveryStatus === 'RETURNING' && <>
          <label className="block text-sm font-semibold" htmlFor="return-recipient">Người nhận kiện trả phía người bán<input id="return-recipient" className={`${input} mt-2`} value={form.recipientName} maxLength={100} disabled={busy} onChange={e => change({ recipientName: e.target.value })} /></label>
          <label className="flex items-start gap-3 text-sm"><input id="return-confirmed" type="checkbox" checked={form.handoverConfirmed} disabled={busy} onChange={e => change({ handoverConfirmed: e.target.checked })} />Tôi đã thực sự bàn giao trả kiện cho người bán/người nhận tại điểm trả.</label>
          <p className="text-sm text-amber-800">Đây là lời xác nhận của tài xế kèm thông tin bàn giao, chưa phải OTP hay xác nhận độc lập của người bán. Không đánh dấu nếu chưa trả kiện.</p>
          {!data.actions.CONFIRM_RETURN.allowed && <p className="text-amber-800">{data.actions.CONFIRM_RETURN.message}</p>}
          <button type="button" className={btn.primary} disabled={busy || loading || !data.actions.CONFIRM_RETURN.allowed} onClick={() => { if (!form.recipientName.trim() || !form.handoverConfirmed) setError('Vui lòng nhập người nhận và xác nhận đã bàn giao trả hàng thực tế.'); else setConfirm('CONFIRM_RETURN') }}>Ghi nhận đã trả hàng</button>
        </>}
      </Card>}
      <ConfirmDialog open={Boolean(confirm)} title={confirm === 'START_RETURN' ? 'Xác nhận chuyển hoàn' : 'Xác nhận đã bàn giao trả kiện'}
        message={confirm === 'START_RETURN' ? 'Ngừng giao và mang kiện về phía người bán. Chưa ghi ReturnedAt và chưa hoàn tiền; không thể giao lại khi đang RETURNING.' : 'Chỉ xác nhận sau khi thực tế đã bàn giao. Thao tác lưu ReturnedAt từ server; trả hàng không đồng nghĩa đã hoàn tiền.'}
        confirmText={confirm === 'START_RETURN' ? 'Xác nhận chuyển hoàn' : 'Xác nhận đã trả kiện'} busy={busy} onClose={() => { if (!busy) setConfirm('') }} onConfirm={() => send(confirm)} />
    </>}
  </>
}
export default function DeliveryFailurePage() {
  const { deliveryId } = useParams()
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header /><main className="d-workspace mx-auto min-h-[600px] max-w-4xl px-4 py-8 sm:px-6"><FailureContent key={deliveryId} id={deliveryId} /></main><Footer /></div>
}
