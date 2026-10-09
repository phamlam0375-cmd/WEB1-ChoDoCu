import { useState } from 'react'
import { toast } from 'react-toastify'
import { BellRing, Eye } from 'lucide-react'
import { DataTable, Field, FilterBar, PageHeader, Pagination, SearchInput, Section, StatusBadge, StatusTabs } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import CommissionDetail from '../../components/admin/CommissionDetail'
import { commissionColumns } from '../../components/admin/commissionColumns'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

// Trang chỉ hiển thị dữ liệu: hoa hồng do hệ thống ghi khi đơn hoàn tất.
export default function AdminCommissionsPage() {
  const [filters, setFilters] = useState({ status: '', overdue: '', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/commissions', filters)
  const { busy, run } = useMutation()

  // Gửi thông báo nhắc nợ cho người bán có khoản quá hạn (mỗi khoản tối đa một lần mỗi ngày).
  const remindOverdue = async () => {
    try {
      const result = await run('post', '/admin/commissions/remind-overdue')
      toast.success(result.message)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
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
        description="Khi đơn hoàn tất, hệ thống ghi một khoản hoa hồng duy nhất theo tỷ lệ đã lưu trên đơn; khoản này được điều chỉnh khi đơn hoàn tiền. Khoản quá hạn được tự nhắc người bán mỗi ngày."
        actions={
          <button type="button" className={btn.secondary} onClick={remindOverdue} disabled={busy}>
            <BellRing size={16} /> Nhắc các khoản quá hạn
          </button>
        }
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

      <Section title="Tìm kiếm và lọc" bodyClassName="px-4 pt-4">
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
      </Section>
      <Section title="Danh sách hoa hồng" meta={response?.pagination ? `${response.pagination.total} kết quả` : null} flush>
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
      </Section>
      {selected && <CommissionDetail commission={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
