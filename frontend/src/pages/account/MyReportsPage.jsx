import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge, Card, DataTable, PageHeader, Pagination, StatusBadge, StatusTabs } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { useApi } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import { REPORT_STATUS, REPORT_TARGET } from '../../lib/labels'

// B04: người gửi theo dõi trạng thái báo cáo của mình.
export default function MyReportsPage() {
  const [filters, setFilters] = useState({ status: '', page: 1 })
  const { response, loading, error, reload } = useApi('/reports', filters)

  const columns = [
    { key: 'ReportId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ReportId}</span> },
    {
      key: 'target',
      title: 'Đối tượng',
      render: (row) => (
        <div>
          <Badge tone="blue">{REPORT_TARGET[row.TargetType]}</Badge>{' '}
          <span className="text-slate-900">{row.OrderId ? `Đơn #${row.OrderId}` : row.Listing?.Title || row.ReportedUser?.FullName}</span>
        </div>
      ),
    },
    { key: 'Reason', title: 'Lý do' },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REPORT_STATUS} value={row.Status} /> },
    { key: 'Resolution', title: 'Kết quả', render: (row) => <p className="max-w-xs text-xs text-slate-600">{row.Resolution || '—'}</p> },
    { key: 'CreatedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader
        code="B04"
        title="Báo cáo vi phạm của tôi"
        actions={
          <Link to="/reports/new" className={btn.primary}>
            <Plus size={16} /> Gửi báo cáo mới
          </Link>
        }
      />
      <Card>
        <div className="px-4 pt-2">
          <StatusTabs map={REPORT_STATUS} value={filters.status} onChange={(status) => setFilters({ status, page: 1 })} />
        </div>
        <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.ReportId} loading={loading} error={error} onRetry={reload} empty="Bạn chưa gửi báo cáo nào" />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
    </>
  )
}
