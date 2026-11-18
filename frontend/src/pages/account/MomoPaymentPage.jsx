import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Copy, Loader2, RotateCw, Send, Smartphone } from 'lucide-react'
import { ErrorState, Loading } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import api, { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { announcePaymentDone } from '../../lib/paymentChannel'
import { copyText } from '../../lib/vietqr'

// Trang thanh toán (mở ở tab mới từ nút "Thanh toán"):
//   /payment?type=fee&ids=12,13&amount=125000&ref=HH000020
//   /payment?type=refund&id=7&amount=300000&ref=HT000007
// Người nộp quét ảnh mã VietQR của tài khoản nhận (MoMo hoặc app ngân hàng). Trong 5 phút trang tự
// kiểm tra tiền đã về chưa (mỗi 5 giây):
//   - Phí website: khoản chuyển "Đã thu" (admin xác nhận, hoặc ngân hàng báo tiền về khớp mã đối soát).
//   - Hoàn tiền: người mua xác nhận đã nhận tiền.
// Nhận được thì báo thành công và tự đóng trang. Nút "Tôi đã chuyển khoản" báo nộp / báo đã chuyển
// trả kèm mã giao dịch để bên nhận đối soát.
const MOMO = '#a50064'
const QR_IMAGE = '/vietqr-bidv.png'
const WAIT_SECONDS = 5 * 60
const POLL_SECONDS = 5
const CLOSE_AFTER_SECONDS = 3
const OPEN_FEE_STATUSES = ['UNPAID', 'ADJUSTED', 'REPORTED']

// Hiển thị đếm ngược dạng phút:giây, ví dụ 300 -> "5:00".
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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

// Hỏi server tiền đã về chưa. Trả về { received } hoặc { error } nếu khoản không còn chờ thanh toán.
async function checkReceived(payment, { first }) {
  if (payment.type === 'fee') {
    const { data } = await api.get('/seller/fee-payments')
    const open = new Set((data.data.items || []).filter((item) => OPEN_FEE_STATUSES.includes(item.Status)).map((item) => item.CommissionId))
    const stillOpen = payment.commissionIds.filter((id) => open.has(id))
    if (first && stillOpen.length < payment.commissionIds.length) {
      return { error: 'Có khoản phí không thuộc về bạn hoặc đã được thu trước đó.' }
    }
    return { received: stillOpen.length === 0 }
  }
  const { data } = await api.get(`/refund-requests/${payment.refundId}`)
  const status = data.data.Status
  if (status === 'COMPLETED') return { received: true }
  if (['REJECTED'].includes(status)) return { error: 'Yêu cầu hoàn tiền đã bị từ chối.' }
  return { received: false }
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
  const navigate = useNavigate()
  const payment = readPayment(params)
  const title = params.get('title') || 'Thanh toán'
  const { data: account, loading, error } = useApi(payment ? '/fee-account' : null)
  const { busy: reporting, run } = useMutation()
  const [transactionCode] = useState(newTransactionCode)
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS)
  const [reported, setReported] = useState('') // thông báo sau khi bấm "Tôi đã chuyển khoản"
  const [result, setResult] = useState(null) // { paidAt }
  const [failure, setFailure] = useState('')
  const [closeIn, setCloseIn] = useState(CLOSE_AFTER_SECONDS)
  const firstCheck = useRef(true)

  const ready = Boolean(payment && account)
  const waiting = ready && !result && !failure && secondsLeft > 0
  const backPath = payment?.type === 'refund' ? '/refunds' : '/seller/fees'

  // Đếm ngược 5 phút kể từ khi hiện mã QR.
  useEffect(() => {
    if (!waiting) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [waiting, secondsLeft])

  // Mỗi 5 giây hỏi server tiền đã về chưa (lần đầu hỏi ngay).
  const poll = useCallback(async () => {
    try {
      const check = await checkReceived(payment, { first: firstCheck.current })
      firstCheck.current = false
      if (check.error) setFailure(check.error)
      else if (check.received) {
        setResult({ paidAt: new Date() })
        announcePaymentDone({ type: payment.type, reference: payment.reference, transactionCode })
      }
    } catch (err) {
      setFailure(errorMessage(err, 'Không kiểm tra được trạng thái thanh toán'))
    }
  }, [payment?.type, payment?.reference, transactionCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waiting) return undefined
    if (firstCheck.current) poll()
    const timer = setInterval(poll, POLL_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [waiting, poll])

  // Đã nhận tiền: đếm 3 giây rồi đóng trang; trình duyệt không cho đóng thì quay về trang trước.
  useEffect(() => {
    if (!result) return undefined
    if (closeIn <= 0) {
      window.close()
      const fallback = setTimeout(() => navigate(backPath, { replace: true }), 300)
      return () => clearTimeout(fallback)
    }
    const timer = setTimeout(() => setCloseIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [result, closeIn, navigate, backPath])

  // Người nộp báo đã chuyển khoản kèm mã giao dịch (người nhận dùng để đối soát); vẫn chờ tiền về.
  const reportTransfer = async () => {
    const body =
      payment.type === 'fee'
        ? { commissionIds: payment.commissionIds, amount: payment.amount, transactionCode }
        : { action: 'SELLER_TRANSFERRED', transactionCode, expectedStatus: 'APPROVED' }
    try {
      const response =
        payment.type === 'fee' ? await run('post', '/seller/fee-payments', body) : await run('patch', `/refund-requests/${payment.refundId}`, body)
      setReported(response.message)
      announcePaymentDone({ type: payment.type, reference: payment.reference, transactionCode, reportedOnly: true })
    } catch (err) {
      setReported('')
      setFailure(errorMessage(err, 'Không gửi được thông tin chuyển khoản'))
    }
  }

  const retry = () => {
    firstCheck.current = true
    setFailure('')
    setSecondsLeft(WAIT_SECONDS)
  }

  if (!payment) {
    return <ErrorState message="Liên kết thanh toán không hợp lệ. Vui lòng quay lại trang trước và bấm Thanh toán lần nữa." />
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  const receiverLabel = payment.type === 'fee' ? 'website xác nhận đã thu' : 'người mua xác nhận đã nhận tiền'

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
            <p className="text-lg font-semibold text-slate-900">Đã nhận được tiền</p>
            <p className="text-sm text-slate-600">
              {payment.type === 'fee' ? `Website đã thu khoản ${payment.reference}.` : `Người mua đã xác nhận nhận tiền hoàn ${payment.reference}.`}
            </p>
            <div className="mt-3 w-full text-left">
              <CopyRow label="Nội dung" value={payment.reference} />
              <CopyRow label="Đã nhận" value={String(payment.amount)} display={formatMoney(payment.amount)} />
            </div>
            <p className="text-xs text-slate-500">
              Lúc {formatDateTime(result.paidAt)}. Trang sẽ tự đóng sau {Math.max(closeIn, 0)} giây.
            </p>
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

            <div className="space-y-2 px-5 pb-5 pt-2">
              {failure ? (
                <div className="space-y-2">
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>
                  <button type="button" className={`${btn.secondary} w-full`} onClick={retry}>
                    <RotateCw size={16} /> Kiểm tra lại
                  </button>
                </div>
              ) : secondsLeft <= 0 ? (
                <div className="space-y-2">
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Sau 5 phút chưa thấy tiền về. Nếu bạn đã chuyển khoản, hãy chờ {receiverLabel} rồi bấm kiểm tra lại.
                  </p>
                  <button type="button" className={`${btn.secondary} w-full`} onClick={retry}>
                    <RotateCw size={16} /> Kiểm tra lại (5 phút)
                  </button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3">
                  <p className="flex items-center justify-between text-sm text-slate-700">
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" style={{ color: MOMO }} /> Đang chờ tiền về
                    </span>
                    <b className="tabular-nums">Còn {clock(secondsLeft)}</b>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${((WAIT_SECONDS - secondsLeft) / WAIT_SECONDS) * 100}%`, backgroundColor: MOMO }}
                    />
                  </div>
                </div>
              )}

              {!failure && (reported ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{reported}</p>
              ) : (
                <button type="button" className={`${btn.primary} w-full`} onClick={reportTransfer} disabled={reporting}>
                  <Send size={16} /> Tôi đã chuyển khoản (mã giao dịch {transactionCode})
                </button>
              ))}
              <p className="text-center text-xs text-slate-500">
                Trang tự kiểm tra mỗi {POLL_SECONDS} giây trong 5 phút; nhận được tiền ({receiverLabel}) thì tự đóng.
              </p>
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
