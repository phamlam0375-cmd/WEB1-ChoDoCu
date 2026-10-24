import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Card, ErrorState, Loading, PageHeader, Pagination } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { useTrackingResource } from '../../components/D05_TheoDoiDonHang/useTrackingResource'
import { listBuyerOrders } from '../../services/D05_TheoDoiDonHang/trackingApi'
import { formatDateTime, formatDecimalMoney } from '../../lib/format'
import { ORDER_STATUS, PAYMENT_STATUS, DELIVERY_STATUS } from '../../lib/labels'
const load = (params, signal) => listBuyerOrders(params, { signal })
const imageUrl = url => typeof url === 'string' && /^(?:https?:\/\/|\/(?!\/))[^\s]+$/i.test(url) ? url : null
export default function BuyerOrdersPage() {
  const [filter, setFilter] = useState({ status: '', page: 1, limit: 20, sort: 'newest' })
  const { data, loading, error, refresh } = useTrackingResource(load, JSON.stringify(filter))
  return <>
    <PageHeader title="Đơn mua của tôi" description="Theo dõi các đơn thuộc tài khoản đang dùng." actions={<button className={btn.secondary} type="button" disabled={loading} onClick={refresh}><RefreshCw size={16} /> Làm mới</button>} />
    <div className="mb-5 flex flex-wrap gap-3">
      <label className="text-sm font-semibold">Trạng thái đơn<select aria-label="Lọc trạng thái đơn" value={filter.status} onChange={event => setFilter(previous => ({ ...previous, status: event.target.value, page: 1 }))} className="ml-2 rounded-lg border border-slate-300 bg-white p-2"><option value="">Tất cả</option>{Object.entries(ORDER_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold">Sắp xếp<select aria-label="Sắp xếp đơn hàng" value={filter.sort} onChange={event => setFilter(previous => ({ ...previous, sort: event.target.value, page: 1 }))} className="ml-2 rounded-lg border border-slate-300 bg-white p-2"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label>
    </div>
    {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refresh} /> : data && <>
      <p className="mb-4 text-sm text-slate-500">Tài khoản #{data.viewer.userId}{data.viewer.demo ? ' · tài khoản thử nghiệm' : ''} · {data.pagination.total} đơn</p>
      {!data.data.length && <Card className="p-6 text-sm text-slate-500">Chưa có đơn mua phù hợp.</Card>}
      <div className="space-y-4">{data.data.map(order => <Card key={order.orderId} className="p-5">
        <div className="flex gap-4">
          {imageUrl(order.product.imageUrl) && <img src={imageUrl(order.product.imageUrl)} alt="" referrerPolicy="no-referrer" className="hidden size-24 rounded-xl bg-slate-100 object-cover sm:block" />}
          <div className="min-w-0 flex-1">
            <Link to={`/orders/${order.orderId}/tracking`} className="break-words text-lg font-bold text-emerald-800">Đơn #{order.orderId} · {order.product.title || 'Sản phẩm'}</Link>
            <p className="mt-1 text-sm text-slate-500">Người bán: {order.seller.name || 'Chưa có thông tin'} · Đặt lúc {formatDateTime(order.createdAt)}</p>
            <p className="mt-3 font-semibold">{order.progress.label}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span>{order.deliveryMethod === 'PICKUP' ? 'Tự đến lấy' : 'Giao tận nơi'}</span><span>Đơn: {ORDER_STATUS[order.orderStatus] || 'Trạng thái khác'}</span><span>Thanh toán: {PAYMENT_STATUS[order.paymentStatus] || 'Chưa có giao dịch'}</span>{order.deliveryMethod === 'DELIVERY' && <span>Giao nhận: {DELIVERY_STATUS[order.deliveryStatus] || 'Chưa có chuyến giao'}</span>}</div>
            <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm"><div><dt className="text-slate-500">Tiền sản phẩm</dt><dd className="font-semibold">{formatDecimalMoney(order.productAmount)}</dd></div><div><dt className="text-slate-500">Phí giao hàng</dt><dd>{formatDecimalMoney(order.deliveryFee)}</dd></div><div><dt className="text-slate-500">Tổng chi phí</dt><dd className="font-bold text-emerald-700">{formatDecimalMoney(order.totalAmount)}</dd></div></dl>
            <Link to={`/orders/${order.orderId}/tracking`} className={`${btn.secondary} mt-4 inline-flex`}>Xem chi tiết</Link>
          </div>
        </div>
      </Card>)}</div>
      <Pagination pagination={data.pagination} onPage={page => setFilter(previous => ({ ...previous, page }))} />
    </>}
  </>
}
