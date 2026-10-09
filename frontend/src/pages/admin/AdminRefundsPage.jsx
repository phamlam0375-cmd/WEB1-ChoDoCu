import { useState } from 'react'
import { toast } from 'react-toastify'
import { Eye, Inbox } from 'lucide-react'
import { DataTable, Field, FilterBar, PageHeader, Pagination, SearchInput, Section, StatusBadge, StatusTabs } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import RefundDetail from '../../components/refund/RefundDetail'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { REFUND_STATUS } from '../../lib/labels'

export default function AdminRefundsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/refund-requests', filters)
  const { busy, run } = useMutation()
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  // Tiếp nhận: yêu cầu chuyển sang "Đang xem xét" rồi mở màn hình giải quyết.
  const receive = async (row) => {
    try {
      const result = await run('patch', `/refund-requests/${row.RefundRequestId}`, { action: 'REVIEW', expectedStatus: row.Status })
      toast.success(result.message)
      reload()
      setSelected(row.RefundRequestId)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns = [
    { key: 'OrderId', title: 'Mã đơn', render: (row) => <span className="font-mono text-xs">#{row.OrderId}</span> },
    { key: 'Requester', title: 'Người mua', render: (row) => row.Requester?.FullName },
    { key: 'Seller', title: 'Người bán', render: (row) => row.Order?.Seller?.FullName },
    { key: 'Reason', title: 'Lý do', render: (row) => <p className="line-clamp-2 max-w-[220px]">{row.Reason}</p> },
    { key: 'Amount', title: 'Số tiền', render: (row) => formatMoney(row.Amount), className: 'whitespace-nowrap text-right tabular-nums' },
    { key: 'RequestedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.RequestedAt), className: 'whitespace-nowrap' },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REFUND_STATUS} value={row.Status} /> },
    {
      key: 'actions',
      title: '',
      render: (row) =>
        row.Status === 'PENDING' ? (
          <button type="button" className={`${btn.primary} px-3 py-1.5`} disabled={busy} onClick={(event) => { event.stopPropagation(); receive(row) }}>
            <Inbox size={15} /> Tiếp nhận
          </button>
        ) : (
          <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row.RefundRequestId) }}>
            <Eye size={15} /> Xem chi tiết
          </button>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Tiếp nhận và giải quyết hoàn tiền"
        description="Người mua gửi yêu cầu theo đơn; quản trị tiếp nhận, xem xét rồi chấp nhận hoặc từ chối. Người bán chuyển trả trực tiếp cho người mua; khi hoàn tất, hoa hồng của đơn được điều chỉnh."
      />
      <Section title="Tìm kiếm và lọc" bodyClassName="px-4 pt-4">
          <StatusTabs map={REFUND_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Mã đơn, tên người mua/bán" />
            <Field label="Từ ngày" className="w-40">
              <input type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className={input} />
            </Field>
            <Field label="Đến ngày" className="w-40">
              <input type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} className={input} />
            </Field>
          </FilterBar>
      </Section>
      <Section title="Danh sách yêu cầu hoàn tiền" meta={response?.pagination ? `${response.pagination.total} kết quả` : null} flush>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.RefundRequestId}
          onRowClick={(row) => setSelected(row.RefundRequestId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Section>
      {selected && <RefundDetail id={selected} viewer="admin" onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
