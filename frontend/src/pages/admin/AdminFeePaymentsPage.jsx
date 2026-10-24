import { useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import { Check, Eye } from 'lucide-react'
import { Badge, ConfirmDialog, DataTable, FilterBar, PageHeader, Pagination, SearchInput, Section, StatusBadge } from '../../components/admin/AdminUi'
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
    { key: 'ItemCount', sortable: true, title: 'Số khoản', className: 'text-right tabular-nums' },
    { key: 'Unpaid', sortable: true, title: 'Còn nợ', render: (row) => formatMoney(row.Unpaid), className: 'text-right tabular-nums font-semibold' },
    { key: 'Reported', sortable: true, title: 'Chờ xác nhận', render: (row) => formatMoney(row.Reported), className: 'text-right tabular-nums' },
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
  const [checked, setChecked] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const selectable = view === 'REPORTED'
  const pageRows = response?.data || []
  const allChecked = pageRows.length > 0 && pageRows.every((row) => checked.includes(row.CommissionId))
  const toggle = (id) => setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  const checkedTotal = pageRows.filter((row) => checked.includes(row.CommissionId)).reduce((sum, row) => sum + Number(row.AmountDue), 0)

  // Xác nhận đã thu nhiều khoản "Chờ xác nhận" một lần.
  const submitBulk = async () => {
    try {
      const result = await run('post', '/admin/fee-payments/bulk-review', { ids: checked, action: 'CONFIRM' })
      if (result.data.failed.length) toast.warn(result.message)
      else toast.success(result.message)
      setBulkOpen(false)
      setChecked([])
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

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
    ...(selectable
      ? [
          {
            key: 'select',
            title: (
              <input
                type="checkbox"
                className="size-4 accent-emerald-600"
                checked={allChecked}
                onChange={() => setChecked(allChecked ? [] : pageRows.map((row) => row.CommissionId))}
                aria-label="Chọn tất cả khoản trên trang"
              />
            ),
            render: (row) => (
              <input
                type="checkbox"
                className="size-4 accent-emerald-600"
                checked={checked.includes(row.CommissionId)}
                onChange={() => toggle(row.CommissionId)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Chọn khoản ${row.PaymentReference}`}
              />
            ),
          },
        ]
      : []),
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
      <Section title="Mục đối soát" flush>
        <div className="flex gap-1 overflow-x-auto px-4 pt-2" role="tablist">
          {Object.entries(VIEWS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => {
                setView(key)
                setChecked([])
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
      </Section>
      {isDebtors ? (
        <Section title="Người bán còn nợ phí" bodyClassName="pt-4">
          <Debtors />
        </Section>
      ) : (
        <>
          <Section title="Tìm kiếm" bodyClassName="px-4 pt-4">
              <FilterBar>
                <SearchInput value={filters.q} onChange={(q) => setFilters({ q, page: 1 })} placeholder="Mã đối soát (HH...), mã đơn, người bán" />
              </FilterBar>
          </Section>
          <Section title={VIEWS[view].label} meta={response?.pagination ? `${response.pagination.total} khoản` : null} flush>
            {selectable && checked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm">
                <span className="font-medium text-emerald-900">
                  Đã chọn {checked.length} khoản · {formatMoney(checkedTotal)}
                </span>
                <button type="button" className={`${btn.primary} py-1.5`} onClick={() => setBulkOpen(true)}>
                  <Check size={15} /> Xác nhận đã thu {checked.length} khoản
                </button>
                <button type="button" className={`${btn.ghost} py-1.5`} onClick={() => setChecked([])}>
                  Bỏ chọn
                </button>
              </div>
            )}
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
          </Section>
        </>
      )}

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
      <ConfirmDialog
        open={bulkOpen}
        title={`Xác nhận đã thu ${checked.length} khoản?`}
        message={`Tổng ${formatMoney(checkedTotal)}. Chỉ xác nhận khi đã đối chiếu sao kê ngân hàng. Người bán nhận thông báo, thao tác được ghi nhật ký.`}
        confirmText="Xác nhận đã thu"
        busy={busy}
        onConfirm={submitBulk}
        onClose={() => setBulkOpen(false)}
      />
    </>
  )
}
