import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Copy, Loader2, Smartphone } from 'lucide-react'
import { ErrorState, Loading } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import VietQrCode from '../../components/VietQrCode'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { announcePaymentDone } from '../../lib/paymentChannel'
import { copyText } from '../../lib/vietqr'

// Trang thanh toán giả lập ví MoMo, mở ở tab mới từ nút "Thanh toán":
//   /payment?type=fee&ids=12,13&amount=125000&ref=HH000020
//   /payment?type=refund&id=7&amount=300000&ref=HT000007
// Mã QR điền sẵn số tiền và nội dung. Bấm "Đã chuyển tiền" thì hệ thống tự báo nộp phí
// (chờ quản trị đối soát) hoặc báo đã chuyển trả hoàn tiền, với mã giao dịch MoMo vừa tạo.
const MOMO = '#a50064'

const newTransactionCode = () => `MOMO${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`

function readPayment(params) {
  const type = params.get('type')
  const amount = Math.round(Number(params.get('amount')))
  const reference = (params.get('ref') || '').trim()
  if (!Number.isFinite(amount) || amount <= 0 || !reference) return null
  if (type === 'fee') {
    const commissionIds = (params.get('ids') || '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)
    return commissionIds.length ? { type, commissionIds, amount, reference } : null
  }
  if (type === 'refund') {
    const refundId = Number(params.get('id'))
    return Number.isInteger(refundId) && refundId > 0 ? { type, refundId, amount, reference } : null
  }
  return null
}

function CopyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <b className="truncate font-mono text-slate-900">{value}</b>
        <button type="button" className="shrink-0 text-slate-400 hover:text-[#a50064]" onClick={() => copyText(value)} aria-label={`Sao chép ${label.toLowerCase()}`}>
          <Copy size={15} />
        </button>
      </span>
    </div>
  )
}

export default function MomoPaymentPage() {
  const [params] = useSearchParams()
  const payment = readPayment(params)
  const title = params.get('title') || 'Thanh toán'
  const { data: account, loading, error } = useApi(payment ? '/fee-account' : null)
  const { busy, run } = useMutation()
  const [transactionCode] = useState(newTransactionCode)
  const [result, setResult] = useState(null) // { message, paidAt }
  const [failure, setFailure] = useState('')

  if (!payment) {
    return <ErrorState message="Liên kết thanh toán không hợp lệ. Vui lòng quay lại trang trước và bấm Thanh toán lần nữa." />
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  const confirmPaid = async () => {
    setFailure('')
    try {
      const response =
        payment.type === 'fee'
          ? await run('post', '/seller/fee-payments', { commissionIds: payment.commissionIds, amount: payment.amount, transactionCode })
          : await run('patch', `/refund-requests/${payment.refundId}`, { action: 'SELLER_TRANSFERRED', transactionCode, expectedStatus: 'APPROVED' })
      setResult({ message: response.message, paidAt: new Date() })
      announcePaymentDone({ type: payment.type, reference: payment.reference, transactionCode })
    } catch (err) {
      setFailure(errorMessage(err, 'Không ghi nhận được thanh toán'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-5 text-white" style={{ backgroundColor: MOMO }}>
          <p className="text-sm font-medium text-white/80">Thanh toán qua ví MoMo</p>
          <p className="mt-1 text-lg font-semibold">{title}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums">{formatMoney(payment.amount)}</p>
        </div>

        {result ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <CheckCircle2 size={48} className="text-emerald-600" />
            <p className="text-lg font-semibold text-slate-900">Thanh toán thành công</p>
            <p className="text-sm text-slate-600">{result.message}</p>
            <div className="mt-3 w-full text-left">
              <CopyRow label="Mã giao dịch" value={transactionCode} />
              <CopyRow label="Nội dung" value={payment.reference} />
            </div>
            <p className="text-xs text-slate-500">Lúc {formatDateTime(result.paidAt)}. Trang trước đã được cập nhật trạng thái.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-5 py-5">
              <div className="rounded-2xl p-2" style={{ backgroundColor: MOMO }}>
                <VietQrCode
                  bankCode={account.bankCode}
                  accountNumber={account.accountNumber}
                  amount={payment.amount}
                  content={payment.reference}
                  size={220}
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Smartphone size={14} /> Mở MoMo → Quét mã. Số tiền và nội dung đã điền sẵn.
              </p>
            </div>
            <div className="px-5 py-2">
              <CopyRow label="Số tiền" value={String(payment.amount)} />
              <CopyRow label="Nội dung" value={payment.reference} />
              <CopyRow label="Mã giao dịch" value={transactionCode} />
            </div>
            <div className="space-y-2 px-5 pb-5 pt-2">
              {failure && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>}
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: MOMO }}
                onClick={confirmPaid}
                disabled={busy}
              >
                {busy && <Loader2 size={16} className="animate-spin" />} Đã chuyển tiền
              </button>
              <p className="text-center text-xs text-slate-500">Giả lập: bấm sau khi quét mã để ghi nhận chuyển tiền thành công.</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <button type="button" className={btn.secondary} onClick={() => window.close()}>
          Đóng trang
        </button>
      </div>
    </div>
  )
}
