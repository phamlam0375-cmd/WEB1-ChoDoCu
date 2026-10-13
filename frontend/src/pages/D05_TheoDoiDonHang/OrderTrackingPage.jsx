import { useCallback, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Card, ErrorState, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import TrackingTimeline from '../../components/D05_TheoDoiDonHang/TrackingTimeline'
import ReservationCountdown from '../../components/D05_TheoDoiDonHang/ReservationCountdown'
import { useTrackingResource } from '../../components/D05_TheoDoiDonHang/useTrackingResource'
import { getOrderTracking } from '../../services/D05_TheoDoiDonHang/trackingApi'
import { formatDateTime, formatDecimalMoney } from '../../lib/format'
import { ORDER_STATUS, PAYMENT_STATUS, DELIVERY_STATUS, REFUND_STATUS } from '../../lib/labels'

const load = ({ orderId, historyPage }, signal) => getOrderTracking(orderId, { historyPage, historyLimit: 20 }, { signal })
const actionLabels = { cancel: 'Hủy đơn', payment: 'Thanh toán / Báo chuyển tiền', confirmPayment: 'Xác nhận nhận tiền', refund: 'Yêu cầu hoàn tiền', receive: 'Xác nhận nhận hàng', chat: 'Liên hệ tài xế' }
function TrackingDetail({ orderId }) {
  const [historyPage, setHistoryPage] = useState(1)
  const { data, loading, error, notice, refresh } = useTrackingResource(load, JSON.stringify({ orderId, historyPage }), true)
  const expiredDeadline = useRef(null)
  const deadline = data?.reservedUntil
  const onExpire = useCallback(() => {
    if (!deadline || expiredDeadline.current === deadline) return
    expiredDeadline.current = deadline
    refresh()
  }, [deadline, refresh])
  return <>
    <PageHeader title={`Theo dõi đơn hàng${data ? ` #${data.orderId}` : ''}`} actions={<>
      <Link to="/orders" className={btn.secondary}>Đơn mua của tôi</Link>
      <button className={btn.secondary} type="button" disabled={loading} onClick={refresh}><RefreshCw size={16} /> Làm mới</button>
    </>} />
    {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refresh} /> : data && <>
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <Card className="mb-5 p-5 sm:p-6">
        <p className="text-sm text-slate-500">Tài khoản #{data.viewer.userId}{data.viewer.demo ? ' · tài khoản thử nghiệm' : ''}</p>
        <h2 className="mt-2 text-xl font-bold text-emerald-800">{data.progress.label}</h2>
        <p className="mt-2 text-sm text-slate-600">{data.progress.description}</p>
        {data.reservedUntil && <ReservationCountdown deadline={data.reservedUntil} serverNow={data.serverNow} onExpire={onExpire} />}
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Thông tin đơn hàng</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">Sản phẩm</dt><dd className="break-words font-semibold">{data.product.title || 'Chưa có thông tin'}</dd></div>
            <div><dt className="text-slate-500">Người bán</dt><dd>{data.seller.name || 'Chưa có thông tin'}</dd></div>
            <div><dt className="text-slate-500">Đặt lúc</dt><dd>{formatDateTime(data.createdAt)}</dd></div>
            <div><dt className="text-slate-500">Trạng thái đơn</dt><dd>{ORDER_STATUS[data.orderStatus] || 'Trạng thái khác'}</dd></div>
            <div><dt className="text-slate-500">Thanh toán</dt><dd>{PAYMENT_STATUS[data.paymentStatus] || 'Chưa có giao dịch'}</dd></div>
            {data.productAmount !== undefined && <div><dt className="text-slate-500">Tiền sản phẩm (trả người bán)</dt><dd className="font-bold">{formatDecimalMoney(data.productAmount)}</dd></div>}
            <div><dt className="text-slate-500">Phí giao hàng (trả tài xế)</dt><dd>{formatDecimalMoney(data.deliveryFee)}</dd></div>
            {data.totalAmount !== undefined && <div><dt className="text-slate-500">Tổng chi phí</dt><dd className="font-bold text-emerald-700">{formatDecimalMoney(data.totalAmount)}</dd></div>}
            {data.payment?.reportedAt && <div><dt className="text-slate-500">Báo chuyển tiền lúc</dt><dd>{formatDateTime(data.payment.reportedAt)}</dd></div>}
            {data.payment?.confirmedAt && <div><dt className="text-slate-500">Người bán xác nhận lúc</dt><dd>{formatDateTime(data.payment.confirmedAt)}</dd></div>}
            {data.completedAt && <div><dt className="text-slate-500">Hoàn tất lúc</dt><dd>{formatDateTime(data.completedAt)}</dd></div>}
          </dl>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Thông tin nhận hàng</h2>
          <p className="mt-4 font-semibold">{data.deliveryMethod === 'PICKUP' ? 'Tự đến lấy' : 'Giao tận nơi'}</p>
          <p className="mt-3 text-sm">{data.receiver.name} · {data.receiver.phone}</p>
          {data.deliveryMethod === 'DELIVERY' && <p className="mt-2 break-words text-sm text-slate-600">{data.receiver.address || 'Chưa có địa chỉ nhận hàng'}</p>}
          {data.deliveryMethod === 'PICKUP' ? <p className="mt-4 text-sm text-slate-500">Nhận trực tiếp từ người bán, không có chuyến tài xế. Chờ dữ liệu bàn giao và xác nhận nhận hàng.</p> : <>
            {!data.deliveries.some(d => d.driver) && <p className="mt-4 text-sm text-slate-500">Chưa có tài xế nhận chuyến.</p>}
            {!data.deliveries.length && <p className="mt-2 text-sm text-slate-500">Chưa có chuyến giao được tạo.</p>}
            {data.deliveries.map(d => <section key={d.deliveryId} className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <h3 className="font-bold">Chuyến #{d.deliveryId} · {DELIVERY_STATUS[d.status] || 'Trạng thái khác'}</h3>
              {d.driver && <p>Tài xế: {d.driver.name || 'Đã phân công'}{d.driver.phone ? ` · ${d.driver.phone}` : ''}</p>}
              <p className="break-words">Lấy hàng: {d.pickupAddress}</p><p className="break-words">Giao đến: {d.deliveryAddress}</p>
              <p>Phí chuyến đã lưu: {formatDecimalMoney(d.driverFee)}</p>
              {[[d.acceptedAt, 'Nhận chuyến'], [d.pickedUpAt, 'Lấy hàng'], [d.deliveredAt, 'Giao thành công'], [d.returnedAt, 'Trả hàng']].filter(([at]) => at).map(([at, label]) => <p key={label}>{label}: {formatDateTime(at)}</p>)}
              {d.failureReason && <p className="whitespace-pre-wrap text-rose-700">Lý do giao chưa thành công: {d.failureReason}</p>}
            </section>)}
          </>}
          {data.buyerNote && <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-600">Ghi chú đặt hàng: {data.buyerNote}</p>}
        </Card>
      </div>
      {data.cancelReason && <Card className="mt-5 p-5"><h2 className="font-bold">Lý do hủy</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm">{data.cancelReason}</p></Card>}
      {!!data.refunds.length && <Card className="mt-5 p-5"><h2 className="font-bold">Hoàn tiền</h2>{data.refunds.map(r => <div key={r.refundId} className="mt-4 text-sm"><p className="font-semibold">Yêu cầu #{r.refundId} · {REFUND_STATUS[r.status]?.label || 'Trạng thái khác'}</p><p>{formatDecimalMoney(r.amount)} · {formatDateTime(r.requestedAt)}</p><p className="mt-1 whitespace-pre-wrap break-words">{r.reason}</p></div>)}</Card>}
      <Card className="mt-5 p-5">
        <h2 className="font-bold">Thao tác liên quan</h2>
        <div className="mt-4 flex flex-wrap gap-3">{Object.entries(data.capabilities).filter(([, action]) => action.enabled && action.href).map(([key, action]) => <Link key={key} to={action.href} className={btn.secondary}>{actionLabels[key]}</Link>)}</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-500">{Object.entries(data.capabilities).filter(([key, action]) => !action.enabled && (data.viewer.role === 'BUYER' ? key !== 'confirmPayment' : key === 'confirmPayment' || key === 'chat')).map(([key, action]) => <li key={key}>{actionLabels[key]}: {action.reason}</li>)}</ul>
      </Card>
      <TrackingTimeline histories={data.histories} pagination={data.historyPagination} onPage={setHistoryPage} />
    </>}
  </>
}
export default function OrderTrackingPage() {
  const { orderId } = useParams()
  return <TrackingDetail key={orderId} orderId={orderId} />
}
