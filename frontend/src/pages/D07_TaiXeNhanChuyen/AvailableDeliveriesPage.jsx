import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, ErrorState, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { getAccessToken } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatDecimalMoney } from '../../lib/format'
import { getDriverStatus, getAvailableDeliveries, acceptDelivery } from '../../services/D07_TaiXeNhanChuyen/assignmentApi'
import AcceptDeliveryDialog from '../../components/D07_TaiXeNhanChuyen/AcceptDeliveryDialog'

const applicationLabels = { PENDING: 'Đang chờ B02 duyệt', NEED_INFO: 'Cần bổ sung hồ sơ', REJECTED: 'Đã bị từ chối', APPROVED: 'Đã được B02 duyệt' }

function DriverDeliveries() {
  const location = useLocation()
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ pickupArea: '', deliveryArea: '', vehicleType: '', sort: 'oldest' })
  const [result, setResult] = useState({ loading: true, status: null, list: null, error: '', unauthorized: false })
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [accepted, setAccepted] = useState(null)
  const submittingRef = useRef(false)
  const requestRevision = useRef(0)
  const refresh = () => { requestRevision.current++; setRevision(value => value + 1) }
  const paramsKey = JSON.stringify({ page, limit: 12, ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)) })
  useEffect(() => {
    const controller = new AbortController()
    const current = ++requestRevision.current
    async function load() {
      setResult(previous => ({ ...previous, loading: true, error: '' }))
      try {
        const status = await getDriverStatus(controller.signal)
        const list = status.policy.allowed ? await getAvailableDeliveries(JSON.parse(paramsKey), controller.signal) : null
        if (!controller.signal.aborted && current === requestRevision.current) setResult({ loading: false, status, list, error: '', unauthorized: false })
      } catch (error) {
        if (!controller.signal.aborted && current === requestRevision.current) setResult({ loading: false, status: null, list: null, error: errorMessage(error), unauthorized: error.response?.status === 401 })
      }
    }
    load()
    return () => controller.abort()
  }, [paramsKey, revision])

  async function confirm() {
    if (submittingRef.current || !selected) return
    submittingRef.current = true; setSubmitting(true); setNotice('')
    // Chặn phản hồi GET cũ ghi đè trạng thái sau khi thao tác đã commit.
    requestRevision.current++
    try {
      const response = await acceptDelivery(selected.deliveryId)
      setNotice(response.message); setAccepted(response.data); setSelected(null)
    } catch (error) {
      if (error.response?.status === 401) setResult(previous => ({ ...previous, unauthorized: true }))
      setNotice(errorMessage(error, 'Không nhận được phản hồi. Hãy tải lại để kiểm tra chuyến trước khi thử lại.'))
      setSelected(null)
    } finally {
      submittingRef.current = false; setSubmitting(false); refresh()
    }
  }
  if (!getAccessToken({ sessionOnly: true }) || result.unauthorized) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace state={{ from: location }} />
  }
  const { status, list, loading, error } = result
  return <>
    <PageHeader title="Chuyến có thể nhận" description="D07 · Nhận chuyến chưa phải xác nhận đã lấy hàng." actions={<button type="button" className={btn.secondary} onClick={refresh} disabled={loading || submitting}>Tải lại</button>} />
    {loading && status && <p role="status" className="mb-3 text-sm text-slate-600">Đang tải lại chuyến…</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    {accepted && <Card className="mb-5 p-5"><p>Chuyến #{accepted.deliveryId} đã được phân công.</p><Link className={btn.primary} to={accepted.trackingUrl}>Mở thông tin chuyến đã nhận</Link>{accepted.pickupUrl && <Link className={`${btn.secondary} ml-2`} to={accepted.pickupUrl}>Xác nhận đã lấy hàng</Link>}</Card>}
    {loading && !status ? <Loading /> : error ? <ErrorState message={error} onRetry={refresh} /> : status && <>
      <Card className="mb-5 space-y-3 p-5">
        <h2 className="text-lg font-bold">Trạng thái tài xế</h2>
        <p>{status.application ? applicationLabels[status.application.Status] || status.application.Status : 'Chưa đăng ký DRIVER tại C01'}</p>
        {status.application?.ReviewNote && <p className="whitespace-pre-wrap text-sm">Phản hồi B02: {status.application.ReviewNote}</p>}
        {status.profile && <p>{status.profile.availabilityStatus} · {status.profile.vehicleType} · {status.profile.serviceArea}{status.profile.maxDistanceKm ? ` · Bán kính tối đa ${status.profile.maxDistanceKm} km` : ''}</p>}
        <p>{status.policy.message}</p>
        {(!status.application || ['REJECTED', 'NEED_INFO'].includes(status.application.Status)) && <Link className={btn.secondary} to="/partner-application?type=DRIVER">Mở hồ sơ đối tác DRIVER (C01)</Link>}
        {status.activeDelivery && <Link className={btn.primary} to={status.activeDelivery.trackingUrl}>Theo dõi chuyến #{status.activeDelivery.deliveryId} · {status.activeDelivery.status}</Link>}
        {status.activeDelivery?.pickupUrl && <Link className={`${btn.secondary} ml-2`} to={status.activeDelivery.pickupUrl}>Xác nhận đã lấy hàng</Link>}
        {status.activeDelivery?.progressUrl && <Link className={`${btn.secondary} ml-2`} to={status.activeDelivery.progressUrl}>Cập nhật tiến độ giao hàng</Link>}
        {status.activeDelivery?.blocked && <p role="alert" className="font-semibold text-rose-700">Đơn đang {status.activeDelivery.orderStatus}. Tạm dừng thực hiện chuyến và theo dõi xử lý; không tự xác nhận lấy/giao hàng hoặc chuyển AVAILABLE.</p>}
        <details className="text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Các chức năng còn chờ tích hợp</summary><ul className="mt-3 space-y-2">{Object.entries(status.dependencies).map(([key, message]) => <li key={key}>{message}</li>)}</ul></details>
      </Card>
      {status.policy.allowed && <>
        <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => event.preventDefault()} aria-label="Lọc chuyến">
          {[['pickupArea', 'Khu vực lấy'], ['deliveryArea', 'Khu vực giao'], ['vehicleType', 'Phương tiện']].map(([key, label]) => <label key={key} className="text-sm">{label}<input className={`${input} mt-1`} value={filters[key]} maxLength={key === 'vehicleType' ? 30 : 100} onChange={event => { setFilters(previous => ({ ...previous, [key]: event.target.value })); setPage(1) }} /></label>)}
          <label className="text-sm">Thứ tự<select className={`${input} mt-1`} value={filters.sort} onChange={event => { setFilters(previous => ({ ...previous, sort: event.target.value })); setPage(1) }}><option value="oldest">Chuyến cũ trước</option><option value="newest">Chuyến mới trước</option></select></label>
        </form>
        {!list?.data.length && <Card className="p-6"><h2 className="font-bold">Chưa có chuyến phù hợp</h2><p className="mt-2 text-sm text-slate-600">Chỉ hiển thị đơn DELIVERY đã được D04 xác nhận tiền, có dữ liệu C07/D12 hợp lệ và phù hợp hồ sơ của bạn. Không tự tạo chuyến từ đơn PAID.</p></Card>}
        <div className="grid gap-4 sm:grid-cols-2">{list?.data.map(delivery => <Card key={delivery.deliveryId} className="space-y-3 p-5">
          <h2 className="text-lg font-bold">Chuyến #{delivery.deliveryId}</h2>
          <p>{delivery.pickupArea} → {delivery.deliveryArea}</p><p>Phương tiện: {delivery.vehicleType}</p>
          <p className="font-semibold text-emerald-800">Phí tài xế: {formatDecimalMoney(delivery.driverFee)}</p>
          <p className="text-sm text-slate-500">Sẵn sàng lấy: {formatDateTime(delivery.readyAt)}</p>
          <button type="button" className={btn.primary} disabled={submitting || loading} onClick={() => setSelected(delivery)}>Nhận chuyến</button>
        </Card>)}</div>
        {list && <div className="mt-5 flex items-center justify-between gap-3"><button type="button" className={btn.secondary} disabled={page <= 1 || submitting} onClick={() => setPage(value => value - 1)}>Trang trước</button><span>Trang {page}/{list.pagination.totalPages} · {list.pagination.total} chuyến</span><button type="button" className={btn.secondary} disabled={page >= list.pagination.totalPages || submitting} onClick={() => setPage(value => value + 1)}>Trang sau</button></div>}
      </>}
    </>}
    {selected && <AcceptDeliveryDialog delivery={selected} submitting={submitting} onClose={() => setSelected(null)} onConfirm={confirm} />}
  </>
}
export default function AvailableDeliveriesPage() {
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header /><main className="mx-auto min-h-[600px] max-w-5xl px-4 py-8 sm:px-6"><DriverDeliveries /></main><Footer /></div>
}
