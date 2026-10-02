import { Badge, StatusBadge } from './AdminUi'
import { formatDate, formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

// Cột bảng hoa hồng dùng chung cho trang hoa hồng và trang đối soát phí.
export const commissionColumns = [
  { key: 'PaymentReference', title: 'Mã đối soát', render: (row) => <span className="font-mono text-xs">{row.PaymentReference}</span> },
  {
    key: 'order',
    title: 'Đơn hàng',
    render: (row) => (
      <div className="max-w-[220px]">
        <p className="truncate font-medium text-slate-900">#{row.OrderId} · {row.Order?.Listing?.Title}</p>
        <p className="text-xs text-slate-500">Hoàn tất {formatDate(row.Order?.CompletedAt)}</p>
      </div>
    ),
  },
  { key: 'Seller', title: 'Người bán', render: (row) => row.Seller?.FullName },
  { key: 'ProductAmount', title: 'Giá SP', render: (row) => formatMoney(row.Order?.ProductAmount), className: 'whitespace-nowrap text-right tabular-nums' },
  { key: 'Rate', title: 'Tỷ lệ', render: (row) => `${Number(row.Rate)}%`, className: 'text-right tabular-nums' },
  {
    key: 'AmountDue',
    title: 'Phải nộp',
    render: (row) => (
      <div className="text-right tabular-nums">
        <p className="font-semibold text-slate-900">{formatMoney(row.AmountDue)}</p>
        {Number(row.AdjustmentAmount) !== 0 && (
          <p className="text-xs text-violet-700">
            gốc {formatMoney(row.OriginalAmount)} · điều chỉnh {formatMoney(row.AdjustmentAmount)}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'DueAt',
    title: 'Hạn nộp',
    render: (row) => (
      <span className="whitespace-nowrap">
        {formatDate(row.DueAt)} {row.IsOverdue && <Badge tone="red">Quá hạn</Badge>}
      </span>
    ),
  },
  { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={COMMISSION_STATUS} value={row.Status} /> },
]

