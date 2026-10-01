import { useState } from 'react'
import {
  Card,
  DataTable,
  Field,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  StatusTabs,
} from '../../components/admin/AdminUi'
import { input } from '../../components/admin/styles'
import RefundDetail from '../../components/refund/RefundDetail'
import { useApi } from '../../hooks/useApi'
import { formatDateTime, formatMoney } from '../../lib/format'
import { REFUND_STATUS } from '../../lib/labels'

export default function AdminRefundsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/refund-requests', filters)
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'RefundRequestId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.RefundRequestId}</span> },
    {
      key: 'order',
      title: 'Đơn hàng',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-slate-900">#{row.OrderId} · {row.Order?.Listing?.Title}</p>
          <p className="text-xs text-slate-500">Mua: {row.Requester?.FullName} · Bán: {row.Order?.Seller?.FullName}</p>
        </div>
      ),
    },
    { key: 'Reason', title: 'Lý do', render: (row) => <p className="line-clamp-2 max-w-xs">{row.Reason}</p> },
    { key: 'Amount', title: 'Số tiền', render: (row) => formatMoney(row.Amount), className: 'whitespace-nowrap text-right tabular-nums' },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REFUND_STATUS} value={row.Status} /> },
    { key: 'RequestedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.RequestedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader
        code="B06 · B07"
        title="Tiếp nhận và giải quyết hoàn tiền"
        description="Người mua gửi yêu cầu theo đơn; quản trị xét duyệt, người bán chuyển trả trực tiếp cho người mua. Khi hoàn tất, hoa hồng của đơn được điều chỉnh theo số tiền hoàn."
      />
      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={REFUND_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Mã đơn, mã yêu cầu, tên người mua/bán" />
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
          rowKey={(row) => row.RefundRequestId}
          onRowClick={(row) => setSelected(row.RefundRequestId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <RefundDetail id={selected} viewer="admin" onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
