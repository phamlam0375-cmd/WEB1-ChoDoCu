import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Copy, Loader2, RotateCw, Smartphone } from 'lucide-react'
import { ErrorState, Loading } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { announcePaymentDone } from '../../lib/paymentChannel'
import { copyText } from '../../lib/vietqr'

// Trang thanh toán (mở ở tab mới từ nút "Thanh toán"):
//   /payment?type=fee&ids=12,13&amount=125000&ref=HH000020
//   /payment?type=refund&id=7&amount=300000&ref=HT000007
// Người nộp quét ảnh mã VietQR của tài khoản nhận (MoMo hoặc app ngân hàng).
// Giả lập nhận tiền: sau 10 giây trang tự kiểm tra giao dịch, coi như đã nhận đủ tiền và báo
// nộp phí (chờ quản trị đối soát) hoặc báo đã chuyển trả hoàn tiền.
const MOMO = '#a50064'
const QR_IMAGE = '/vietqr-bidv.png'
const WAIT_SECONDS = 10

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
  const { run } = useMutation()
  const [transactionCode] = useState(newTransactionCode)
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null) // { message, paidAt }
  const [failure, setFailure] = useState('')
  const submitted = useRef(false)

  const ready = Boolean(payment && account)

  // Đếm ngược 10 giây kể từ khi hiện mã QR.
  useEffect(() => {
    if (!ready || result || failure || secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [ready, result, failure, secondsLeft])

  // Hết giờ: tự kiểm tra giao dịch (giả lập đã nhận đủ tiền) và ghi nhận thanh toán.
  useEffect(() => {
    if (!ready || secondsLeft > 0 || submitted.current) return
    submitted.current = true
    setChecking(true)
    const body =
      payment.type === 'fee'
        ? { commissionIds: payment.commissionIds, amount: payment.amount, transactionCode }
        : { action: 'SELLER_TRANSFERRED', transactionCode, expectedStatus: 'APPROVED' }
    const request =
      payment.type === 'fee' ? run('post', '/seller/fee-payments', body) : run('patch', `/refund-requests/${payment.refundId}`, body)
    request
      .then((response) => {
        setResult({ message: response.message, paidAt: new Date() })
        announcePaymentDone({ type: payment.type, reference: payment.reference, transactionCode })
      })
      .catch((err) => setFailure(errorMessage(err, 'Không ghi nhận được thanh toán')))
      .finally(() => setChecking(false))
  }, [ready, secondsLeft, payment, run, transactionCode])

  const retry = () => {
    submitted.current = false
    setFailure('')
    setSecondsLeft(WAIT_SECONDS)
  }

  if (!payment) {
    return <ErrorState message="Liên kết thanh toán không hợp lệ. Vui lòng quay lại trang trước và bấm Thanh toán lần nữa." />
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-5 text-white" style={{ backgroundColor: MOMO }}>
          <p className="text-sm font-medium text-white/80">Thanh toán qua MoMo hoặc app ngân hàng</p>
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
              <CopyRow label="Đã nhận" value={String(payment.amount)} display={formatMoney(payment.amount)} />
            </div>
            <p className="text-xs text-slate-500">Lúc {formatDateTime(result.paidAt)}. Trang trước đã được cập nhật trạng thái.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-5 py-5">
              <img src={QR_IMAGE} alt={`Mã VietQR ${account.bankName} ${account.accountNumber}`} className="w-64 max-w-full rounded-xl" />
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Smartphone size={14} /> Mở MoMo hoặc app ngân hàng → Quét mã, nhập số tiền và nội dung bên dưới.
              </p>
            </div>
            <div className="px-5 py-2">
              <CopyRow label="Số tiền" value={String(payment.amount)} display={formatMoney(payment.amount)} />
              <CopyRow label="Nội dung" value={payment.reference} />
              <CopyRow label="Số tài khoản" value={account.accountNumber} display={`${account.bankName} · ${account.accountNumber}`} />
            </div>

            <div className="px-5 pb-5 pt-2">
              {failure ? (
                <div className="space-y-2">
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>
                  <button type="button" className={`${btn.secondary} w-full`} onClick={retry}>
                    <RotateCw size={16} /> Kiểm tra lại
                  </button>
                </div>
              ) : checking || secondsLeft <= 0 ? (
                <p className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                  <Loader2 size={16} className="animate-spin" style={{ color: MOMO }} /> Đang kiểm tra giao dịch...
                </p>
              ) : (
                <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3">
                  <p className="flex items-center justify-between text-sm text-slate-700">
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" style={{ color: MOMO }} /> Đang chờ nhận tiền
                    </span>
                    <b className="tabular-nums">Kiểm tra sau {secondsLeft} giây</b>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${((WAIT_SECONDS - secondsLeft) / WAIT_SECONDS) * 100}%`, backgroundColor: MOMO }}
                    />
                  </div>
                </div>
              )}
              <p className="mt-2 text-center text-xs text-slate-500">Giả lập: sau {WAIT_SECONDS} giây hệ thống coi như đã nhận đủ tiền.</p>
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
