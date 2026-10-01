import { useState } from 'react'
import { toast } from 'react-toastify'
import { AlertTriangle, Copy } from 'lucide-react'
import { Badge, Card, ConfirmDialog, DataTable, ErrorState, Field, Loading, PageHeader, Pagination, StatusBadge } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

function copy(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success('Đã sao chép'),
    () => toast.error('Không sao chép được'),
  )
}

// B08 + B09 phía người bán: phí còn nợ, tài khoản nhận phí, báo đã nộp và lịch sử hoa hồng.
export default function SellerFeesPage() {
  const { data, error, reload } = useApi('/seller/fee-payments')
  const [page, setPage] = useState(1)
  const history = useApi('/seller/commissions', { page })
  const { busy, run } = useMutation()
  const [selected, setSelected] = useState([])
  const [proofUrl, setProofUrl] = useState('')
  const [confirming, setConfirming] = useState(false)

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <Loading />

  const payable = data.items.filter((item) => ['UNPAID', 'ADJUSTED'].includes(item.Status))
  const chosen = payable.filter((item) => selected.includes(item.CommissionId))
  const total = chosen.reduce((sum, item) => sum + Number(item.AmountDue), 0)
  const transferContent = chosen.map((item) => item.PaymentReference).join(' ')

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const submit = async () => {
    if (!/^(https?:\/\/|\/)\S+$/i.test(proofUrl.trim())) {
      toast.error('Vui lòng nhập đường dẫn ảnh chứng từ chuyển khoản hợp lệ')
      return
    }
    try {
      const result = await run('post', '/seller/fee-payments', { commissionIds: selected, proofUrl: proofUrl.trim() })
      toast.success(result.message)
      setConfirming(false)
      setSelected([])
      setProofUrl('')
      reload()
      history.reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const historyColumns = [
    { key: 'PaymentReference', title: 'Mã đối soát', render: (row) => <span className="font-mono text-xs">{row.PaymentReference}</span> },
    { key: 'order', title: 'Đơn', render: (row) => `#${row.OrderId} · ${row.Order?.Listing?.Title || ''}` },
    { key: 'Rate', title: 'Tỷ lệ', render: (row) => `${Number(row.Rate)}%` },
    { key: 'AmountDue', title: 'Phải nộp', render: (row) => formatMoney(row.AmountDue), className: 'text-right tabular-nums' },
    { key: 'DueAt', title: 'Hạn', render: (row) => <>{formatDate(row.DueAt)} {row.IsOverdue && <Badge tone="red">Quá hạn</Badge>}</> },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={COMMISSION_STATUS} value={row.Status} /> },
  ]

  return (
    <>
      <PageHeader code="B08 · B09" title="Phí và hoa hồng" description="Mỗi đơn hoàn tất phát sinh một khoản hoa hồng. Chuyển khoản cho website với nội dung là mã đối soát rồi báo đã nộp để quản trị viên xác nhận." />

      {data.summary.overLimit && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Phí chưa nộp ({formatMoney(data.summary.unpaid)}) đã vượt ngưỡng {formatMoney(data.summary.debtLimit)}. Vui lòng nộp phí để tiếp tục sử dụng đầy đủ dịch vụ.
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Chưa nộp</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(data.summary.unpaid)}</p>
          {data.summary.overdueCount > 0 && <Badge tone="red">{data.summary.overdueCount} khoản quá hạn</Badge>}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Đã báo nộp, chờ xác nhận</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(data.summary.reported)}</p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Tài khoản nhận phí của website</p>
          <p className="mt-1 font-semibold text-slate-900">{data.bankAccount.bankName}</p>
          <p className="flex items-center gap-2 font-mono text-base">
            {data.bankAccount.accountNumber}
            <button type="button" className="text-slate-400 hover:text-emerald-700" onClick={() => copy(data.bankAccount.accountNumber)} aria-label="Sao chép số tài khoản">
              <Copy size={14} />
            </button>
          </p>
          <p className="text-slate-600">{data.bankAccount.accountHolder}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Khoản cần nộp</h2>
          <p className="text-xs text-slate-500">Chọn các khoản đã chuyển khoản trong cùng một giao dịch.</p>
        </div>
        {data.items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Bạn không còn khoản phí nào cần nộp.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((item) => {
              const canPay = ['UNPAID', 'ADJUSTED'].includes(item.Status)
              return (
                <li key={item.CommissionId}>
                  <label className={`flex items-center gap-3 px-5 py-3 text-sm ${canPay ? 'cursor-pointer hover:bg-emerald-50/40' : ''}`}>
                    <input type="checkbox" className="accent-emerald-600" disabled={!canPay} checked={selected.includes(item.CommissionId)} onChange={() => toggle(item.CommissionId)} />
                    <span className="w-24 font-mono text-xs">{item.PaymentReference}</span>
                    <span className="min-w-0 flex-1 truncate">Đơn #{item.OrderId} · {item.Order?.Listing?.Title}</span>
                    <span className="hidden text-xs text-slate-500 sm:inline">Hạn {formatDate(item.DueAt)} {item.IsOverdue && <Badge tone="red">Quá hạn</Badge>}</span>
                    <StatusBadge map={COMMISSION_STATUS} value={item.Status} />
                    <span className="w-28 text-right font-semibold tabular-nums">{formatMoney(item.AmountDue)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        {payable.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-sm text-slate-600">
              Đã chọn {chosen.length} khoản · <b className="tabular-nums text-slate-900">{formatMoney(total)}</b>
            </p>
            <button type="button" className={btn.primary} disabled={!chosen.length} onClick={() => setConfirming(true)}>
              Báo đã nộp
            </button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-900">Lịch sử hoa hồng theo đơn</h2>
        <DataTable columns={historyColumns} rows={history.response?.data} rowKey={(row) => row.CommissionId} loading={history.loading} error={history.error} onRetry={history.reload} empty="Chưa có khoản hoa hồng nào" />
        <Pagination pagination={history.response?.pagination} onPage={setPage} />
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Báo đã nộp phí"
        confirmText="Gửi báo nộp"
        busy={busy}
        onConfirm={submit}
        onClose={() => setConfirming(false)}
        message={
          <div className="space-y-1">
            <p>Số tiền: <b>{formatMoney(total)}</b> → {data.bankAccount.bankName} {data.bankAccount.accountNumber} ({data.bankAccount.accountHolder})</p>
            <p className="flex items-center gap-2">
              Nội dung chuyển khoản: <code className="rounded bg-slate-100 px-1.5 py-0.5">{transferContent}</code>
              <button type="button" className="text-slate-400 hover:text-emerald-700" onClick={() => copy(transferContent)} aria-label="Sao chép nội dung">
                <Copy size={14} />
              </button>
            </p>
          </div>
        }
      >
        <Field className="mt-4" label="Đường dẫn ảnh chứng từ chuyển khoản *">
          <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} className={input} placeholder="https://" />
        </Field>
      </ConfirmDialog>
    </>
  )
}
