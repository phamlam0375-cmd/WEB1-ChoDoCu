import { useState } from 'react'
import { Eye } from 'lucide-react'
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
import { btn, input } from '../../components/admin/styles'
import CommissionDetail from '../../components/admin/CommissionDetail'
import { commissionColumns } from '../../components/admin/commissionColumns'
import { useApi } from '../../hooks/useApi'
import { formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

// Trang chỉ hiển thị dữ liệu: hoa hồng do hệ thống ghi khi đơn hoàn tất.
export default function AdminCommissionsPage() {
  const [filters, setFilters] = useState({ status: '', overdue: '', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/commissions', filters)
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))
  const totals = response?.totals || {}
  const countTotals = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.count]))

  const columns = [
    ...commissionColumns,
    {
      key: 'actions',
      title: '',
      className: 'whitespace-nowrap',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row) }}>
          <Eye size={15} /> Xem chi tiết
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Hoa hồng theo đơn"
        description="Khi đơn hoàn tất, hệ thống ghi một khoản hoa hồng duy nhất theo tỷ lệ đã lưu trên đơn; khoản này được điều chỉnh khi đơn hoàn tiền."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Object.entries(COMMISSION_STATUS).map(([key, item]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <StatusBadge map={COMMISSION_STATUS} value={key} />
            <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">{formatMoney(totals[key]?.amount || 0)}</p>
            <p className="text-xs text-slate-500">{totals[key]?.count || 0} khoản · {item.label.toLowerCase()}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={COMMISSION_STATUS} value={filters.overdue ? '__overdue' : filters.status} onChange={(status) => update({ status, overdue: '' })} counts={countTotals} />
          <FilterBar onReset={() => setFilters({ status: '', overdue: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tên người bán, mã đơn, mã đối soát" />
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-red-600" checked={filters.overdue === 'true'} onChange={(event) => update({ overdue: event.target.checked ? 'true' : '', status: '' })} />
              Chỉ khoản quá hạn
            </label>
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
          rowKey={(row) => row.CommissionId}
          onRowClick={setSelected}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <CommissionDetail commission={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
