import { useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import {
  Badge,
  Card,
  ConfirmDialog,
  DataTable,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import CommissionDetail from '../../components/admin/CommissionDetail'
import { commissionColumns } from '../../components/admin/commissionColumns'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { FEE_STATUS } from '../../lib/labels'

// Nhóm trạng thái theo cách gọi của trang thu phí: Còn nợ / Chờ xác nhận / Đã thu.
const VIEWS = {
  OWED: { label: 'Còn nợ', status: 'UNPAID,ADJUSTED' },
  REPORTED: { label: 'Chờ xác nhận', status: 'REPORTED' },
  PAID: { label: 'Đã thu', status: 'PAID' },
  DEBTORS: { label: 'Công nợ người bán' },
}

const FEE_ACTIONS = {
  CONFIRM: { label: 'Xác nhận đã thu', tone: 'primary', from: ['UNPAID', 'ADJUSTED', 'REPORTED'], style: btn.primary },
  REJECT: { label: 'Chưa nhận được', tone: 'danger', reason: 'Lý do (người bán sẽ thấy)', required: true, from: ['REPORTED'], style: btn.secondary },
  WAIVE: { label: 'Miễn khoản phí', tone: 'danger', reason: 'Lý do miễn', required: true, from: ['UNPAID', 'ADJUSTED', 'REPORTED'], style: btn.ghost },
}

// Cột trạng thái dùng tên của trang thu phí thay cho tên của trang hoa hồng.
const feeColumns = commissionColumns.map((column) =>
  column.key === 'Status' ? { ...column, render: (row) => <StatusBadge map={FEE_STATUS} value={row.Status} /> } : column,
)

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
    { key: 'Unpaid', title: 'Còn nợ', render: (row) => formatMoney(row.Unpaid), className: 'text-right tabular-nums font-semibold' },
    { key: 'Reported', title: 'Chờ xác nhận', render: (row) => formatMoney(row.Reported), className: 'text-right tabular-nums' },
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
        Ngưỡng nợ hiện tại: <b>{formatMoney(response?.debtLimit)}</b> (đổi tại <Link to="/admin/settings" className="text-emerald-700 underline">Cấu hình quy tắc</Link>).
      </p>
      <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.SellerId} loading={loading} error={error} onRetry={reload} empty="Không có người bán nào đang nợ phí" />
      <Pagination pagination={response?.pagination} onPage={setPage} />
    </>
  )
}

export default function AdminFeePaymentsPage() {
  const [view, setView] = useState('REPORTED')
  const [filters, setFilters] = useState({ q: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const [pending, setPending] = useState(null) // { action, row }
  const isDebtors = view === 'DEBTORS'
  const { response, loading, error, reload } = useApi(isDebtors ? null : '/admin/fee-payments', { ...filters, status: VIEWS[view].status })
  const { busy, run } = useMutation()

  const submit = async (note) => {
    try {
      const result = await run('patch', `/admin/fee-payments/${pending.row.CommissionId}`, { action: pending.action, note: note || undefined })
      toast.success(result.message)
      setPending(null)
      setSelected(null)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const totals = response?.totals || {}
  const countOf = (key) => (VIEWS[key].status || '').split(',').reduce((sum, status) => sum + (totals[status]?.count || 0), 0)

  const columns = [
    ...feeColumns,
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
  const rule = FEE_ACTIONS[pending?.action]

  return (
    <>
      <PageHeader
        title="Thu và đối soát phí website"
        description="Người bán chuyển hoa hồng theo mã đối soát rồi báo đã nộp kèm mã giao dịch; quản trị đối chiếu sao kê ngân hàng rồi xác nhận đã thu. Mỗi xác nhận được ghi nhật ký."
      />
      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2" role="tablist">
          {Object.entries(VIEWS).map(([key, item]) => (
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
              {item.label}
              {item.status && response?.totals && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{countOf(key)}</span>
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
              columns={columns}
              rows={response?.data}
              rowKey={(row) => row.CommissionId}
              onRowClick={setSelected}
              loading={loading}
              error={error}
              onRetry={reload}
              empty={view === 'REPORTED' ? 'Không có khoản nào chờ xác nhận' : undefined}
            />
            <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        )}
      </Card>

      {selected && (
        <CommissionDetail
          commission={selected}
          statusMap={FEE_STATUS}
          onClose={() => setSelected(null)}
          footer={Object.entries(FEE_ACTIONS)
            .filter(([, item]) => item.from.includes(selected.Status))
            .map(([key, item]) => (
              <button key={key} type="button" className={item.style} onClick={() => setPending({ action: key, row: selected })}>
                {item.label}
              </button>
            ))}
        />
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${rule?.label} — ${pending?.row.PaymentReference}`}
        message={pending && `Khoản ${formatMoney(pending.row.AmountDue)} của ${pending.row.Seller?.FullName} (đơn #${pending.row.OrderId}).`}
        confirmText={rule?.label}
        tone={rule?.tone}
        reasonLabel={rule?.reason || 'Ghi chú (không bắt buộc)'}
        reasonRequired={rule?.required}
        busy={busy}
        onConfirm={submit}
        onClose={() => setPending(null)}
      />
    </>
  )
}
