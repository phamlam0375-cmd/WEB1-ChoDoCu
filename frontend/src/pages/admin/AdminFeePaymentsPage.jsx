import { useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import {
  Badge,
  Card,
  ConfirmDialog,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
} from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { commissionColumns } from '../../components/admin/commissionColumns'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatMoney } from '../../lib/format'

const VIEWS = {
  REPORTED: 'Chờ đối soát',
  UNPAID: 'Chưa nộp',
  ADJUSTED: 'Đã điều chỉnh',
  PAID: 'Đã thu',
  DEBTORS: 'Công nợ người bán',
}

const FEE_ACTIONS = {
  CONFIRM: { label: 'Xác nhận đã thu', tone: 'primary', reason: 'Ghi chú đối soát (không bắt buộc)', required: false },
  REJECT: { label: 'Chưa nhận được', tone: 'danger', reason: 'Lý do (người bán sẽ thấy)', required: true },
  WAIVE: { label: 'Miễn khoản phí', tone: 'danger', reason: 'Lý do miễn', required: true },
}

function Debtors() {
  const [page, setPage] = useState(1)
  const { response, loading, error, reload } = useApi('/admin/fee-payments/debtors', { page })
  const columns = [
    {
      key: 'seller',
      title: 'Người bán',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.FullName} <span className="text-xs text-slate-400">#{row.SellerId}</span></p>
          <p className="text-xs text-slate-500">{row.Phone || row.Email}</p>
        </div>
      ),
    },
    { key: 'ItemCount', title: 'Số khoản', className: 'text-right tabular-nums' },
    { key: 'Unpaid', title: 'Chưa nộp', render: (row) => formatMoney(row.Unpaid), className: 'text-right tabular-nums font-semibold' },
    { key: 'Reported', title: 'Đã báo nộp', render: (row) => formatMoney(row.Reported), className: 'text-right tabular-nums' },
    {
      key: 'flags',
      title: 'Cảnh báo',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.OverLimit && <Badge tone="red">Vượt ngưỡng nợ</Badge>}
          {row.OverdueCount > 0 && <Badge tone="amber">{row.OverdueCount} khoản quá hạn</Badge>}
        </div>
      ),
    },
  ]
  return (
    <>
      <p className="px-4 pb-3 text-sm text-slate-500">
        Ngưỡng nợ hiện tại: <b>{formatMoney(response?.debtLimit)}</b> (đổi tại <Link to="/admin/settings" className="text-emerald-700 underline">Cấu hình B12</Link>).
      </p>
      <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.SellerId} loading={loading} error={error} onRetry={reload} empty="Không có người bán nào đang nợ phí" />
      <Pagination pagination={response?.pagination} onPage={setPage} />
    </>
  )
}

export default function AdminFeePaymentsPage() {
  const [view, setView] = useState('REPORTED')
  const [filters, setFilters] = useState({ q: '', page: 1 })
  const [pending, setPending] = useState(null) // { action, row }
  const isDebtors = view === 'DEBTORS'
  const { response, loading, error, reload } = useApi(isDebtors ? null : '/admin/fee-payments', { ...filters, status: view })
  const { busy, run } = useMutation()

  const submit = async (note) => {
    try {
      const result = await run('patch', `/admin/fee-payments/${pending.row.CommissionId}`, { action: pending.action, note: note || undefined })
      toast.success(result.message)
      setPending(null)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const actionColumn = {
    key: 'actions',
    title: 'Đối soát',
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        {row.PaymentProofUrl && row.Status === 'REPORTED' && (
          <a href={row.PaymentProofUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">Xem chứng từ</a>
        )}
        <div className="flex flex-wrap gap-1">
          {['UNPAID', 'ADJUSTED', 'REPORTED'].includes(row.Status) && (
            <button type="button" className={`${btn.primary} px-2.5 py-1 text-xs`} onClick={() => setPending({ action: 'CONFIRM', row })}>Đã thu</button>
          )}
          {row.Status === 'REPORTED' && (
            <button type="button" className={`${btn.secondary} px-2.5 py-1 text-xs`} onClick={() => setPending({ action: 'REJECT', row })}>Chưa nhận</button>
          )}
          {['UNPAID', 'ADJUSTED', 'REPORTED'].includes(row.Status) && (
            <button type="button" className={`${btn.ghost} px-2 py-1 text-xs text-slate-500`} onClick={() => setPending({ action: 'WAIVE', row })}>Miễn</button>
          )}
        </div>
      </div>
    ),
  }

  return (
    <>
      <PageHeader
        code="B09"
        title="Thu và đối soát phí website"
        description="Người bán chuyển hoa hồng theo mã đối soát rồi báo đã nộp; quản trị kiểm tra sao kê ngân hàng rồi xác nhận đã thu. Mỗi xác nhận được ghi nhật ký."
      />
      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2" role="tablist">
          {Object.entries(VIEWS).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => {
                setView(key)
                setFilters({ q: '', page: 1 })
              }}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${view === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {text}
              {key !== 'DEBTORS' && response?.totals?.[key] && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{response.totals[key].count}</span>
              )}
            </button>
          ))}
        </div>
        {isDebtors ? (
          <div className="pt-4">
            <Debtors />
          </div>
        ) : (
          <>
            <div className="p-4 pb-0">
              <FilterBar>
                <SearchInput value={filters.q} onChange={(q) => setFilters({ q, page: 1 })} placeholder="Mã đối soát (HH...), mã đơn, người bán" />
              </FilterBar>
            </div>
            <DataTable
              columns={[...commissionColumns, actionColumn]}
              rows={response?.data}
              rowKey={(row) => row.CommissionId}
              loading={loading}
              error={error}
              onRetry={reload}
              empty={view === 'REPORTED' ? 'Không có khoản nào chờ đối soát' : undefined}
            />
            <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${FEE_ACTIONS[pending?.action]?.label} — ${pending?.row.PaymentReference}`}
        message={pending && `Khoản ${formatMoney(pending.row.AmountDue)} của ${pending.row.Seller?.FullName} (đơn #${pending.row.OrderId}).`}
        confirmText={FEE_ACTIONS[pending?.action]?.label}
        tone={FEE_ACTIONS[pending?.action]?.tone}
        reasonLabel={FEE_ACTIONS[pending?.action]?.reason}
        reasonRequired={FEE_ACTIONS[pending?.action]?.required}
        busy={busy}
        onConfirm={submit}
        onClose={() => setPending(null)}
      />
    </>
  )
}
