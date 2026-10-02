import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Badge, Card, DataTable, PageHeader, Pagination, StatusBadge } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import CommissionDetail from '../../components/admin/CommissionDetail'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

// Phía người bán: hoa hồng các đơn của mình và tổng số tiền phải nộp.
export default function SellerFeesPage() {
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const { response, loading, error, reload } = useApi('/seller/commissions', { page })
  const summary = response?.summary

  const columns = [
    { key: 'OrderId', title: 'Mã đơn', render: (row) => `#${row.OrderId}` },
    { key: 'ProductAmount', title: 'Giá trị đơn', render: (row) => formatMoney(row.Order?.ProductAmount), className: 'text-right tabular-nums' },
    { key: 'Rate', title: 'Tỷ lệ', render: (row) => `${Number(row.Rate)}%`, className: 'text-right' },
    { key: 'AmountDue', title: 'Hoa hồng', render: (row) => formatMoney(row.AmountDue), className: 'text-right tabular-nums' },
    { key: 'DueAt', title: 'Hạn nộp', render: (row) => <>{formatDate(row.DueAt)} {row.IsOverdue && <Badge tone="red">Quá hạn</Badge>}</> },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={COMMISSION_STATUS} value={row.Status} /> },
    {
      key: 'actions',
      title: '',
      className: 'whitespace-nowrap',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={() => setDetail(row)}>
          <Eye size={15} /> Xem chi tiết
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Hoa hồng của tôi" description="Mỗi đơn hoàn tất phát sinh một khoản hoa hồng theo tỷ lệ đã lưu trên đơn; khoản này được điều chỉnh khi đơn hoàn tiền." />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Tổng số tiền phải nộp</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(summary?.unpaid || 0)}</p>
          {summary?.overdueCount > 0 && <Badge tone="red">{summary.overdueCount} khoản quá hạn</Badge>}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Chờ xác nhận</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(summary?.reported || 0)}</p>
        </Card>
      </div>
      <Card>
        <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.CommissionId} loading={loading} error={error} onRetry={reload} empty="Chưa có khoản hoa hồng nào" />
        <Pagination pagination={response?.pagination} onPage={setPage} />
      </Card>
      {detail && <CommissionDetail commission={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
