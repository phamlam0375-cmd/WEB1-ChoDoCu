import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Copy, Loader2, Smartphone } from 'lucide-react'
import { ErrorState, Loading } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { announcePaymentDone } from '../../lib/paymentChannel'
import { copyText } from '../../lib/vietqr'

// Trang thanh toán (mở ở tab mới từ nút "Thanh toán"):
//   /payment?type=fee&ids=12,13&amount=125000&ref=HH000020
//   /payment?type=refund&id=7&amount=300000&ref=HT000007
// Người nộp quét ảnh mã VietQR của tài khoản nhận (quét được bằng MoMo hoặc app ngân hàng),
// tự nhập số tiền và nội dung, rồi khai số tiền đã chuyển. Chuyển thiếu thì báo số còn thiếu;
// cộng dồn đủ mới báo nộp phí (chờ quản trị đối soát) hoặc báo đã chuyển trả hoàn tiền.
const MOMO = '#a50064'
const QR_IMAGE = '/vietqr-bidv.png'

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

// Số tiền đã chuyển cộng dồn qua các lần (giữ khi tải lại trang trong cùng tab).
const paidKey = (payment) => `choDoCu.paid.${payment.type}.${payment.reference}`
function readPaid(payment) {
  try {
    return Number(sessionStorage.getItem(paidKey(payment))) || 0
  } catch {
    return 0
  }
}
function writePaid(payment, value) {
  try {
    if (value) sessionStorage.setItem(paidKey(payment), String(value))
    else sessionStorage.removeItem(paidKey(payment))
  } catch {
    // Trình duyệt chặn sessionStorage: số đã chuyển chỉ giữ trong lúc mở trang.
  }
}

function CopyRow({ label, value, display }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <b className="truncate font-mono text-slate-900">{display || value}</b>
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
  const [paid, setPaid] = useState(() => (payment ? readPaid(payment) : 0))
  const [entered, setEntered] = useState(() => (payment ? String(Math.max(payment.amount - readPaid(payment), 0)) : ''))
  const [inputError, setInputError] = useState('')
  const [result, setResult] = useState(null) // { message, paidAt, total }
  const [failure, setFailure] = useState('')

  if (!payment) {
    return <ErrorState message="Liên kết thanh toán không hợp lệ. Vui lòng quay lại trang trước và bấm Thanh toán lần nữa." />
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  const remaining = Math.max(payment.amount - paid, 0)

  const confirmPaid = async () => {
    setFailure('')
    const value = Number(String(entered).replace(/[.,\s]/g, ''))
    if (!Number.isInteger(value) || value <= 0) {
      setInputError('Vui lòng nhập số tiền đã chuyển (chỉ gồm chữ số)')
      return
    }
    setInputError('')
    const total = paid + value

    // Chuyển thiếu: ghi nhận phần đã chuyển, báo số còn thiếu, chưa gửi lên hệ thống.
    if (total < payment.amount) {
      setPaid(total)
      writePaid(payment, total)
      setEntered(String(payment.amount - total))
      return
    }

    try {
      const response =
        payment.type === 'fee'
          ? await run('post', '/seller/fee-payments', { commissionIds: payment.commissionIds, amount: payment.amount, transactionCode })
          : await run('patch', `/refund-requests/${payment.refundId}`, { action: 'SELLER_TRANSFERRED', transactionCode, expectedStatus: 'APPROVED' })
      writePaid(payment, 0)
      setPaid(total)
      setResult({ message: response.message, paidAt: new Date(), total })
      announcePaymentDone({ type: payment.type, reference: payment.reference, transactionCode })
    } catch (err) {
      setFailure(errorMessage(err, 'Không ghi nhận được thanh toán'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-5 text-white" style={{ backgroundColor: MOMO }}>
          <p className="text-sm font-medium text-white/80">Thanh toán qua MoMo hoặc app ngân hàng</p>
          <p className="mt-1 text-lg font-semibold">{title}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums">{formatMoney(payment.amount)}</p>
          {paid > 0 && !result && (
            <p className="mt-1 text-sm text-white/90">
              Đã chuyển {formatMoney(paid)} · còn thiếu <b>{formatMoney(remaining)}</b>
            </p>
          )}
        </div>

        {result ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <CheckCircle2 size={48} className="text-emerald-600" />
            <p className="text-lg font-semibold text-slate-900">Thanh toán thành công</p>
            <p className="text-sm text-slate-600">{result.message}</p>
            {result.total > payment.amount && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Bạn đã chuyển thừa {formatMoney(result.total - payment.amount)}. Liên hệ quản trị để được hoàn phần thừa.
              </p>
            )}
            <div className="mt-3 w-full text-left">
              <CopyRow label="Mã giao dịch" value={transactionCode} />
              <CopyRow label="Nội dung" value={payment.reference} />
              <CopyRow label="Đã chuyển" value={String(result.total)} display={formatMoney(result.total)} />
            </div>
            <p className="text-xs text-slate-500">Lúc {formatDateTime(result.paidAt)}. Trang trước đã được cập nhật trạng thái.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-5 py-5">
              <img src={QR_IMAGE} alt={`Mã VietQR ${account.bankName} ${account.accountNumber}`} className="w-64 max-w-full rounded-xl" />
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Smartphone size={14} /> Mở MoMo hoặc app ngân hàng → Quét mã, rồi tự nhập số tiền và nội dung bên dưới.
              </p>
            </div>
            <div className="px-5 py-2">
              <CopyRow label={paid > 0 ? 'Cần chuyển thêm' : 'Số tiền'} value={String(remaining)} display={formatMoney(remaining)} />
              <CopyRow label="Nội dung" value={payment.reference} />
              <CopyRow label="Số tài khoản" value={account.accountNumber} display={`${account.bankName} · ${account.accountNumber}`} />
            </div>

            <div className="space-y-2 px-5 pb-5 pt-2">
              {paid > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Bạn mới chuyển {formatMoney(paid)}, còn thiếu {formatMoney(remaining)}. Vui lòng chuyển thêm {formatMoney(remaining)} với cùng nội dung {payment.reference}.
                </p>
              )}
              <label className="block text-sm font-medium text-slate-700" htmlFor="paid-amount">
                Số tiền bạn vừa chuyển (đồng)
              </label>
              <input
                id="paid-amount"
                inputMode="numeric"
                value={entered}
                onChange={(event) => setEntered(event.target.value)}
                className={`${input} ${inputError ? 'border-red-400' : ''}`}
              />
              {inputError && <p className="text-xs font-medium text-red-600">{inputError}</p>}
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
              <p className="text-center text-xs text-slate-500">Giả lập: nhập đúng số tiền đã chuyển rồi bấm để ghi nhận.</p>
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
