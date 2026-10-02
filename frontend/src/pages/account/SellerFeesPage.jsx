import { useState } from 'react'
import { toast } from 'react-toastify'
import { AlertTriangle, Copy, Eye, QrCode } from 'lucide-react'
import { Badge, Card, DataTable, ErrorState, Field, Loading, Modal, PageHeader, Pagination, StatusBadge } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import CommissionDetail from '../../components/admin/CommissionDetail'
import ImageUpload from '../../components/ImageUpload'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { COMMISSION_STATUS, FEE_STATUS } from '../../lib/labels'
import { copyText } from '../../lib/vietqr'
import VietQrCode from '../../components/VietQrCode'

function CopyButton({ text, label }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline" onClick={() => copyText(text)} aria-label={`Sao chép ${label}`}>
      <Copy size={13} /> Sao chép
    </button>
  )
}

// Nộp phí: mã QR VietQR + form báo đã nộp (mã giao dịch, số tiền, ảnh chuyển khoản).
function PayDialog({ bankAccount, items, reference, onClose, onDone }) {
  const total = items.reduce((sum, item) => sum + Math.round(Number(item.AmountDue)), 0)
  const [form, setForm] = useState({ amount: String(total), transactionCode: '', proofUrl: '' })
  const [errors, setErrors] = useState({})
  const { busy, run } = useMutation()

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.transactionCode.trim()) next.transactionCode = 'Vui lòng nhập mã giao dịch'
    if (Number(form.amount) !== total) next.amount = 'Số tiền không khớp với khoản phí cần nộp'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const result = await run('post', '/seller/fee-payments', {
        commissionIds: items.map((item) => item.CommissionId),
        amount: Number(form.amount),
        transactionCode: form.transactionCode.trim(),
        proofUrl: form.proofUrl || undefined,
      })
      toast.success(result.message)
      onDone()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      title="Nộp phí website"
      onClose={onClose}
      size="max-w-2xl"
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>Đóng</button>
          <button type="submit" form="fee-pay-form" className={btn.primary} disabled={busy}>Báo đã nộp</button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <div className="text-center">
          <VietQrCode bankCode={bankAccount.bankCode} accountNumber={bankAccount.accountNumber} amount={total} content={reference} size={192} className="mx-auto" />
          <p className="mt-1 text-xs text-slate-500">Quét bằng ứng dụng ngân hàng</p>
        </div>
        <div className="space-y-2 text-sm">
          <p>Ngân hàng: <b>{bankAccount.bankName}</b></p>
          <p className="flex flex-wrap items-center gap-2">Số tài khoản: <b className="font-mono">{bankAccount.accountNumber}</b> <CopyButton text={bankAccount.accountNumber} label="số tài khoản" /></p>
          <p>Chủ tài khoản: <b>{bankAccount.accountHolder}</b></p>
          <p>Số tiền: <b className="text-emerald-700">{formatMoney(total)}</b> ({items.length} khoản)</p>
          <p className="flex flex-wrap items-center gap-2">Nội dung (mã đối soát): <b className="font-mono">{reference}</b> <CopyButton text={reference} label="mã đối soát" /></p>
        </div>
      </div>

      <form id="fee-pay-form" onSubmit={submit} className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2" noValidate>
        <Field label="Mã giao dịch *" error={errors.transactionCode}>
          <input value={form.transactionCode} onChange={(event) => setForm({ ...form, transactionCode: event.target.value })} className={input} placeholder="VD: FT26100298765" />
        </Field>
        <Field label="Số tiền đã chuyển (đồng) *" error={errors.amount}>
          <input inputMode="numeric" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.trim() })} className={input} />
        </Field>
        <div className="sm:col-span-2">
          <ImageUpload label="Ảnh chuyển khoản (không bắt buộc)" value={form.proofUrl} onChange={(proofUrl) => setForm({ ...form, proofUrl })} />
        </div>
      </form>
    </Modal>
  )
}

// Phía người bán: phí còn nợ, nộp phí bằng mã QR và hoa hồng các đơn của mình.
export default function SellerFeesPage() {
  const { data, error, reload } = useApi('/seller/fee-payments')
  const [page, setPage] = useState(1)
  const history = useApi('/seller/commissions', { page })
  const [selected, setSelected] = useState([])
  const [paying, setPaying] = useState(false)
  const [detail, setDetail] = useState(null)

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <Loading />

  const payable = data.items.filter((item) => ['UNPAID', 'ADJUSTED'].includes(item.Status))
  const chosen = payable.filter((item) => selected.includes(item.CommissionId))
  const total = chosen.reduce((sum, item) => sum + Number(item.AmountDue), 0)
  // Một khoản: dùng mã đối soát của khoản đó; nhiều khoản: dùng mã đối soát của người bán.
  const reference = chosen.length === 1 ? chosen[0].PaymentReference : data.sellerReference
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const historyColumns = [
    { key: 'OrderId', title: 'Mã đơn', render: (row) => `#${row.OrderId}` },
    { key: 'ProductAmount', title: 'Giá trị đơn', render: (row) => formatMoney(row.Order?.ProductAmount), className: 'text-right tabular-nums' },
    { key: 'Rate', title: 'Tỷ lệ', render: (row) => `${Number(row.Rate)}%`, className: 'text-right' },
    { key: 'AmountDue', title: 'Hoa hồng', render: (row) => formatMoney(row.AmountDue), className: 'text-right tabular-nums' },
    { key: 'DueAt', title: 'Hạn nộp', render: (row) => <>{formatDate(row.DueAt)} {row.IsOverdue && <Badge tone="red">Quá hạn</Badge>}</> },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={COMMISSION_STATUS} value={row.Status} /> },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={() => setDetail(row)}>
          <Eye size={15} /> Xem chi tiết
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Phí website và hoa hồng của tôi" description="Mỗi đơn hoàn tất phát sinh một khoản hoa hồng. Chọn khoản cần nộp, bấm Nộp phí để quét mã QR rồi báo đã nộp kèm mã giao dịch." />

      {data.summary.overLimit && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Phí còn nợ ({formatMoney(data.summary.unpaid)}) đã vượt ngưỡng {formatMoney(data.summary.debtLimit)}. Vui lòng nộp phí để tiếp tục sử dụng đầy đủ dịch vụ.
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Tổng phí còn nợ</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(data.summary.unpaid)}</p>
          {data.summary.overdueCount > 0 && <Badge tone="red">{data.summary.overdueCount} khoản quá hạn</Badge>}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Chờ xác nhận</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(data.summary.reported)}</p>
        </Card>
        <Card className="space-y-1 p-4 text-sm">
          <p className="text-slate-500">Tài khoản nhận phí của website</p>
          <p className="font-semibold text-slate-900">{data.bankAccount.bankName}</p>
          <p className="flex items-center gap-2 font-mono text-base">{data.bankAccount.accountNumber} <CopyButton text={data.bankAccount.accountNumber} label="số tài khoản" /></p>
          <p className="text-slate-600">{data.bankAccount.accountHolder}</p>
          <p className="flex items-center gap-2 text-slate-600">Mã đối soát: <b className="font-mono">{data.sellerReference}</b> <CopyButton text={data.sellerReference} label="mã đối soát" /></p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Khoản phí cần nộp</h2>
          <p className="text-xs text-slate-500">Chọn các khoản sẽ chuyển trong cùng một lần nộp.</p>
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
                    <StatusBadge map={FEE_STATUS} value={item.Status} />
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
            <button type="button" className={btn.primary} disabled={!chosen.length} onClick={() => setPaying(true)}>
              <QrCode size={16} /> Nộp phí
            </button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-900">Hoa hồng của tôi</h2>
        <DataTable columns={historyColumns} rows={history.response?.data} rowKey={(row) => row.CommissionId} loading={history.loading} error={history.error} onRetry={history.reload} empty="Chưa có khoản hoa hồng nào" />
        <Pagination pagination={history.response?.pagination} onPage={setPage} />
      </Card>

      {paying && (
        <PayDialog
          bankAccount={data.bankAccount}
          items={chosen}
          reference={reference}
          onClose={() => setPaying(false)}
          onDone={() => {
            setPaying(false)
            setSelected([])
            reload()
            history.reload()
          }}
        />
      )}
      {detail && <CommissionDetail commission={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
