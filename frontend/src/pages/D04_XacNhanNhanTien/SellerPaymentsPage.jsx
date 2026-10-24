import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import Footer from '../../components/Footer'
import { Card, ErrorState, Loading, PageHeader, Pagination } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { listSellerPayments } from '../../services/D04_XacNhanNhanTien/confirmationApi'

const labels = { REPORTED: 'Chờ xác nhận', REJECTED: 'Chưa nhận được tiền', CONFIRMED: 'Đã nhận đủ tiền', WAITING: 'Chưa báo chuyển tiền', ALL: 'Tất cả' }
const money = value => {
  const [whole, fraction = '00'] = String(value ?? '0').split('.')
  return `${BigInt(whole).toLocaleString('vi-VN')}${fraction !== '00' ? `,${fraction.padEnd(2, '0')}` : ''} ₫`
}

export default function SellerPaymentsPage() {
  const [filter, setFilter] = useState({ page: 1, status: 'REPORTED' })
  const [reload, setReload] = useState(0)
  const [state, setState] = useState(null)
  const key = JSON.stringify([filter, reload])
  useEffect(() => {
    const controller = new AbortController()
    const [params] = JSON.parse(key)
    listSellerPayments({ ...params, limit: 20 }, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setState({ key, response }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key, error: errorMessage(error) }) })
    return () => controller.abort()
  }, [key])
  const loading = state?.key !== key
  return <>
    <PageHeader code="D04" title="Xác nhận nhận tiền" description="Chỉ hiển thị giao dịch của tài khoản người bán đang chọn/đăng nhập. Đối chiếu ngân hàng, không chỉ dựa vào ảnh biên lai." actions={<button type="button" className={btn.secondary} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} /> Tải lại</button>} />
    <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">Trạng thái thanh toán
      <select aria-label="Lọc trạng thái thanh toán" className="rounded-lg border border-slate-300 bg-white px-3 py-2" value={filter.status} onChange={event => setFilter({ page: 1, status: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </label>
    {loading ? <Loading /> : state.error ? <ErrorState message={state.error} onRetry={() => setReload(value => value + 1)} /> : <Card>
      <div className="divide-y divide-slate-100">
        {!state.response.data.length && <p className="p-6 text-sm text-slate-500">Không có giao dịch phù hợp của tài khoản này.</p>}
        {state.response.data.map(item => <Link key={item.orderId} to={`/seller/orders/${item.orderId}/payment`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-emerald-50">
          <div className="min-w-0"><p className="font-bold text-slate-900">Đơn #{item.orderId} · {item.title || 'Sản phẩm'}</p><p className="mt-1 text-sm text-slate-600">Người mua: {item.buyer.name || `#${item.buyer.userId}`} · Báo lúc: {formatDateTime(item.reportedAt)}</p></div>
          <div className="text-right"><p className="font-bold text-emerald-700">{money(item.productAmount)}</p><p className="text-sm text-slate-600">{labels[item.paymentStatus] || item.paymentStatus}</p></div>
        </Link>)}
      </div>
      <Pagination pagination={state.response.pagination} onPage={page => setFilter(previous => ({ ...previous, page }))} />
    </Card>}
    <div className="mt-8"><Footer /></div>
  </>
}
