import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ArrowRightCircle, Eye } from 'lucide-react'
import {
  Badge,
  Card,
  ConfirmDialog,
  DataTable,
  Field,
  FilterBar,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  StatusTabs,
} from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import ReportInfo from '../../components/report/ReportInfo'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { REPORT_STATUS, REPORT_TARGET } from '../../lib/labels'

// Đường dẫn tới trang kiểm duyệt, mở sẵn báo cáo cần xử lý.
const moderationLink = (reportId) => `/admin/listings?tab=reports&report=${reportId}`

function ReportDetail({ id, onClose, onSaved }) {
  const navigate = useNavigate()
  const { data: report, loading, error } = useApi(`/admin/reports/${id}`)
  const { busy, run } = useMutation()
  const [confirming, setConfirming] = useState(false)

  // Chuyển xử lý: báo cáo sang "Đang xử lý" rồi mở trang kiểm duyệt.
  const transfer = async () => {
    try {
      const result = await run('patch', `/admin/reports/${id}`, { status: 'PROCESSING', expectedStatus: report.Status })
      toast.success(result.message)
      onSaved()
      navigate(moderationLink(id))
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirming(false)
    }
  }

  return (
    <Modal
      open
      title={`Báo cáo vi phạm #${id}`}
      onClose={onClose}
      size="max-w-2xl"
      footer={
        report && (
          <>
            <button type="button" className={btn.secondary} onClick={onClose}>Đóng</button>
            {report.Status === 'PENDING' && (
              <button type="button" className={btn.primary} onClick={() => setConfirming(true)}>
                <ArrowRightCircle size={16} /> Chuyển xử lý
              </button>
            )}
            {report.Status === 'PROCESSING' && (
              <button type="button" className={btn.primary} onClick={() => navigate(moderationLink(id))}>
                <ArrowRightCircle size={16} /> Mở trang xử lý
              </button>
            )}
          </>
        )
      }
    >
      {loading && !report ? <Loading /> : error ? <p className="text-sm text-red-600">{error}</p> : <ReportInfo report={report} />}
      <ConfirmDialog
        open={confirming}
        title="Chuyển xử lý báo cáo?"
        message="Báo cáo sẽ chuyển sang &quot;Đang xử lý&quot; và mở trang kiểm duyệt tin để xử lý."
        confirmText="Chuyển xử lý"
        busy={busy}
        onConfirm={transfer}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  )
}

export default function AdminReportsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', targetType: '', reason: '', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/reports', filters)
  const { data: reasons } = useApi('/reports/reasons')
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'ReportId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ReportId}</span> },
    { key: 'TargetType', title: 'Đối tượng', render: (row) => <Badge tone="blue">{REPORT_TARGET[row.TargetType]}</Badge> },
    {
      key: 'target',
      title: 'Nội dung bị báo cáo',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-slate-900">
            {row.Order ? `Đơn #${row.Order.OrderId}` : row.Listing ? row.Listing.Title : row.ReportedUser?.FullName}
          </p>
          {row.ReportedUser && <p className="text-xs text-slate-500">Tài khoản: {row.ReportedUser.FullName}</p>}
        </div>
      ),
    },
    { key: 'Reason', title: 'Lý do' },
    { key: 'Reporter', title: 'Người gửi', render: (row) => row.Reporter?.FullName },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REPORT_STATUS} value={row.Status} /> },
    { key: 'CreatedAt', title: 'Thời gian', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row.ReportId) }}>
          <Eye size={15} /> Xem chi tiết
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Tiếp nhận báo cáo vi phạm" description="Báo cáo mới nhất hiện trước. Xem chi tiết và bấm Chuyển xử lý để chuyển báo cáo sang trang kiểm duyệt tin." />
      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={REPORT_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', targetType: '', reason: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tiêu đề tin, tên hoặc mã" />
            <Field className="w-36">
              <select value={filters.targetType} onChange={(event) => update({ targetType: event.target.value })} className={input} aria-label="Loại đối tượng">
                <option value="">Mọi đối tượng</option>
                {Object.entries(REPORT_TARGET).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </Field>
            <Field className="w-48">
              <select value={filters.reason} onChange={(event) => update({ reason: event.target.value })} className={input} aria-label="Lý do">
                <option value="">Mọi lý do</option>
                {reasons?.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </Field>
            <Field label="Từ ngày" className="w-40">
              <input type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className={input} />
            </Field>
            <Field label="Đến ngày" className="w-40">
              <input type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} className={input} />
            </Field>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.ReportId}
          onRowClick={(row) => setSelected(row.ReportId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <ReportDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
