import { Pagination } from '../admin/AdminUi'
import { formatDateTime } from '../../lib/format'
import { ORDER_STATUS, PAYMENT_STATUS, DELIVERY_STATUS, REFUND_STATUS } from '../../lib/labels'
const groups = { ORDER: 'Đơn hàng', PAYMENT: 'Thanh toán', DELIVERY: 'Giao nhận', REFUND: 'Hoàn tiền' }
const maps = { ORDER: ORDER_STATUS, PAYMENT: PAYMENT_STATUS, DELIVERY: DELIVERY_STATUS, REFUND: REFUND_STATUS }
export default function TrackingTimeline({ histories, pagination, onPage }) {
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="text-lg font-bold">Lịch sử tiến trình</h2>
    {!histories.length && <p className="mt-4 text-sm text-slate-500">Chưa có lịch sử được lưu cho đơn này.</p>}
    <ol className="mt-5 space-y-5 border-l-2 border-emerald-100 pl-5">
      {histories.map(item => {
        const label = maps[item.group]?.[item.status]
        return <li key={item.historyId} className="relative break-words">
          <span aria-hidden="true" className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">{groups[item.group] || 'Cập nhật'} · {formatDateTime(item.at)}</p>
          <p className="mt-1 text-sm font-bold">{typeof label === 'string' ? label : label?.label || 'Trạng thái khác'}</p>
          {item.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.note}</p>}
          {item.actor && <p className="mt-1 text-xs text-slate-500">Thực hiện: {item.actor.name || `Tài khoản #${item.actor.userId}`}</p>}
        </li>
      })}
    </ol>
    <Pagination pagination={pagination} onPage={onPage} />
  </section>
}
