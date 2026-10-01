import { useState } from 'react'
import { toast } from 'react-toastify'
import { RefreshCw } from 'lucide-react'
import {
  Card,
  ConfirmDialog,
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
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'
import { commissionColumns } from '../../components/admin/commissionColumns'

export default function AdminCommissionsPage() {
  const [filters, setFilters] = useState({ status: '', overdue: '', q: '', from: '', to: '', page: 1 })
  const [confirmSync, setConfirmSync] = useState(false)
  const { response, loading, error, reload } = useApi('/admin/commissions', filters)
  const { busy, run } = useMutation()
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))
  const totals = response?.totals || {}

  const sync = async () => {
    try {
      const result = await run('post', '/admin/commissions/sync')
      toast.success(result.message)
      setConfirmSync(false)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const countTotals = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.count]))

  return (
    <>
      <PageHeader
        code="B08"
        title="Hoa hồng theo đơn"
        description="Khi đơn hoàn tất, hệ thống ghi một khoản hoa hồng theo tỷ lệ đã chốt trên đơn; khoản này được điều chỉnh khi đơn hoàn tiền."
        actions={
          <button type="button" className={btn.secondary} onClick={() => setConfirmSync(true)}>
            <RefreshCw size={16} /> Tính cho đơn còn thiếu
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

      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={COMMISSION_STATUS} value={filters.overdue ? '__overdue' : filters.status} onChange={(status) => update({ status, overdue: '' })} counts={countTotals} />
          <FilterBar onReset={() => setFilters({ status: '', overdue: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Mã đối soát, mã đơn, người bán" />
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-red-600" checked={filters.overdue === 'true'} onChange={(event) => update({ overdue: event.target.checked ? 'true' : '', status: '' })} />
              Chỉ khoản quá hạn
            </label>
            <Field label="Đơn hoàn tất từ" className="w-40">
              <input type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className={input} />
            </Field>
            <Field label="đến" className="w-40">
              <input type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} className={input} />
            </Field>
          </FilterBar>
        </div>
        <DataTable columns={commissionColumns} rows={response?.data} rowKey={(row) => row.CommissionId} loading={loading} error={error} onRetry={reload} />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>

      <ConfirmDialog
        open={confirmSync}
        title="Tính hoa hồng cho đơn còn thiếu?"
        message="Hệ thống tìm các đơn đã hoàn tất nhưng chưa có khoản hoa hồng và ghi khoản phải nộp (mỗi đơn một lần). Dùng cho đơn cũ hoặc đơn hoàn tất khi chưa tính được hoa hồng."
        confirmText="Tính hoa hồng"
        busy={busy}
        onConfirm={sync}
        onClose={() => setConfirmSync(false)}
      />
    </>
  )
}
