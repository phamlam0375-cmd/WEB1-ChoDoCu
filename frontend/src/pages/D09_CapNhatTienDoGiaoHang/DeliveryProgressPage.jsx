import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, ErrorState, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { getAccessToken } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import { DELIVERY_STATUS, ORDER_STATUS } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { getProgress, updateProgress, newProgressRequestId } from '../../services/D09_CapNhatTienDoGiaoHang/progressApi'

function ProgressContent({ id }) {
  const location = useLocation(), generation = useRef(0), sendingRef = useRef(false), pending = useRef(null)
  const [revision, setRevision] = useState(0)
  const [resource, setResource] = useState({ loading: true, data: null, error: '', unauthorized: false })
  const [status, setStatus] = useState(''), [note, setNote] = useState('')
  const [sending, setSending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const refresh = () => { generation.current++; setRevision(value => value + 1) }
  useEffect(() => {
    const controller = new AbortController(), current = ++generation.current
    async function load() {
      setResource(previous => ({ ...previous, loading: true, error: '' }))
      try {
        const data = await getProgress(id, { signal: controller.signal })
        if (!controller.signal.aborted && current === generation.current) setResource({ loading: false, data, error: '', unauthorized: false })
      } catch (e) {
        if (!controller.signal.aborted && current === generation.current) setResource(previous => ({ ...previous, loading: false, error: errorMessage(e), unauthorized: e.response?.status === 401 }))
      }
    }
    load(); return () => controller.abort()
  }, [id, revision])
  const { data, loading } = resource
  if (!getAccessToken({ sessionOnly: true }) || resource.unauthorized) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace state={{ from: location }} />
  async function submit(event) {
    event.preventDefault()
    if (sendingRef.current || loading || !data) return
    if (!status) { setError('Vui lòng chọn trạng thái giao hàng.'); return }
    if (status !== 'DELIVERING') { setError('Vui lòng hoàn tất xác thực giao hàng trước.'); return }
    const sameIntent = pending.current?.payload.status === status && pending.current?.payload.note === note.trim()
    const action = sameIntent ? pending.current.payload.action : data.deliveryStatus === 'PICKED_UP' ? 'START' : 'NOTE'
    if (action === 'NOTE' && !note.trim()) { setError('Vui lòng nhập ghi chú tiến độ mới.'); return }
    const payload = { status, note: note.trim(), action }, signature = JSON.stringify(payload)
    // Giữ cùng khóa khi timeout/lỗi và người dùng thử lại cùng ý định. Nội dung mới
    // được coi là ghi chú mới có chủ đích, kể cả trùng câu với sự kiện trước đó.
    if (!pending.current || pending.current.signature !== signature) pending.current = { signature, payload, key: newProgressRequestId() }
    const request = pending.current
    sendingRef.current = true; generation.current++; setSending(true); setError(''); setNotice('')
    try {
      const response = await updateProgress(id, request.payload, request.key)
      setNotice(response.message); pending.current = null; setNote(''); setStatus('')
      setResource(previous => ({ ...previous, data: { ...previous.data, deliveryStatus: response.data.deliveryStatus, orderStatus: response.data.orderStatus } }))
    } catch (e) {
      setError(errorMessage(e, 'Chưa nhận được phản hồi. Hãy tải lại để kiểm tra tiến độ; ghi chú vẫn được giữ để thử lại.'))
      if (e.response?.status === 401) setResource(previous => ({ ...previous, unauthorized: true }))
    } finally { sendingRef.current = false; setSending(false); refresh() }
  }
  return <>
    <PageHeader code="D09" title="Cập nhật tiến độ giao hàng" actions={<>
      <Link className={btn.secondary} to={data?.trackingUrl || '/driver/deliveries'}>Theo dõi đơn/chuyến</Link>
      <button type="button" className={btn.secondary} disabled={sending || loading} onClick={refresh}>Tải lại</button>
    </>} />
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {loading && !data ? <Loading /> : resource.error ? <ErrorState message={resource.error} onRetry={refresh} /> : data && <>
      <Card className="mb-5 space-y-3 break-words p-5">
        <h2 className="text-lg font-bold">Chuyến #{data.deliveryId} · Đơn #{data.orderId}</h2>
        <p>Trạng thái chuyến: <strong>{DELIVERY_STATUS[data.deliveryStatus] || data.deliveryStatus}</strong></p>
        <p>Trạng thái đơn: {ORDER_STATUS[data.orderStatus] || data.orderStatus}</p>
        <p>Sản phẩm/kiện: {data.product.title || `Tin #${data.product.listingId}`}</p>
        <p>Điểm lấy: {data.pickupAddress || 'Chưa có dữ liệu'}</p>
        <p>Điểm giao: {data.deliveryAddress || 'Chưa có dữ liệu'}</p>
        {data.pickedUpAt && <p>Đã lấy hàng: {formatDateTime(data.pickedUpAt)}</p>}
        <Link className={btn.secondary} to={data.trackingUrl}>Xem lịch sử tiến độ D05</Link>
      </Card>
      <Card className="space-y-4 p-5">
        <p role="status" className={data.progress?.allowed ? 'text-emerald-800' : 'text-amber-800'}>{data.progress?.message || 'Chuyến chưa đủ điều kiện cập nhật tiến độ.'}</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold" htmlFor="delivery-progress-status">Trạng thái cập nhật<select id="delivery-progress-status" className={`${input} mt-2`} value={status} disabled={sending} onChange={e => setStatus(e.target.value)}>
            <option value="">Chọn trạng thái giao hàng</option><option value="DELIVERING">Đang giao hàng</option>
          </select></label>
          <label className="block text-sm font-semibold" htmlFor="delivery-progress-note">Ghi chú tiến độ {data.deliveryStatus === 'DELIVERING' ? '(bắt buộc khi bổ sung)' : '(không bắt buộc)'}<textarea id="delivery-progress-note" className={`${input} mt-2 min-h-28`} value={note} maxLength={500} disabled={sending} onChange={e => setNote(e.target.value)} /></label>
          <p className="text-sm text-slate-500">{[...note].length}/500 ký tự. Ghi chú được hiển thị cho người mua, người bán và tài xế được phân công; không nhập mã xác thực hay dữ liệu bí mật.</p>
          <button className={btn.primary} type="submit" disabled={sending || loading || !data.progress?.allowed}>{sending ? 'Đang cập nhật…' : data.deliveryStatus === 'PICKED_UP' ? 'Bắt đầu giao hàng' : 'Lưu ghi chú tiến độ mới'}</button>
        </form>
        <p className="text-sm text-amber-800">D13 chưa triển khai. Chưa có thao tác xác thực giao thành công; D09 không ghi DELIVERED, hoàn tất đơn hoặc thanh toán phí tài xế. D10 giao thất bại/giao lại/chuyển hoàn cũng chưa triển khai; D09 không tự xử lý thay.</p>
      </Card>
    </>}
  </>
}
export default function DeliveryProgressPage() {
  const { deliveryId } = useParams()
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header /><main className="mx-auto min-h-[600px] max-w-4xl px-4 py-8 sm:px-6"><ProgressContent key={deliveryId} id={deliveryId} /></main><Footer /></div>
}
