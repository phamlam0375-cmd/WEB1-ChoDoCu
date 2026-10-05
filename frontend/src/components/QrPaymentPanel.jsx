import { useState } from 'react'
import { Copy, QrCode, RefreshCw, X } from 'lucide-react'
import { btn } from './admin/styles'
import VietQrCode from './VietQrCode'
import { formatDateTime, formatMoney } from '../lib/format'
import { copyText, randomPaymentCode } from '../lib/vietqr'

// Nút "Thanh toán": bấm mới sinh mã QR VietQR, mỗi lần một mã giao dịch ngẫu nhiên khác nhau.
// Nội dung chuyển khoản = mã đối soát + mã giao dịch ngẫu nhiên, để đối chiếu với sao kê.
export default function QrPaymentPanel({ account, amount, reference, buttonLabel = 'Thanh toán', title }) {
  const [payment, setPayment] = useState(null) // { code, createdAt }

  const generate = () => setPayment({ code: randomPaymentCode(), createdAt: new Date() })

  if (!payment) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3">
        <p className="text-sm text-slate-700">
          Cần thanh toán <b className="text-emerald-700">{formatMoney(amount)}</b>
        </p>
        <button type="button" className={btn.primary} onClick={generate}>
          <QrCode size={16} /> {buttonLabel}
        </button>
      </div>
    )
  }

  const content = `${reference} ${payment.code}`
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <VietQrCode
          key={payment.code}
          bankCode={account.bankCode}
          accountNumber={account.accountNumber}
          amount={amount}
          content={content}
          size={168}
        />
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p className="font-semibold text-slate-900">{title || `Quét mã để thanh toán ${formatMoney(amount)}`}</p>
          <p>{account.bankName} · <span className="font-mono">{account.accountNumber}</span></p>
          <p>{account.accountHolder}</p>
          <p className="flex flex-wrap items-center gap-2">
            Nội dung: <b className="font-mono">{content}</b>
            <button type="button" className="text-slate-400 hover:text-emerald-700" onClick={() => copyText(content)} aria-label="Sao chép nội dung">
              <Copy size={14} />
            </button>
          </p>
          <p className="text-xs text-slate-500">
            Mã giao dịch <span className="font-mono">{payment.code}</span> tạo lúc {formatDateTime(payment.createdAt)}. Quét bằng ứng dụng ngân hàng để tự điền tài khoản, số tiền và nội dung.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className={`${btn.secondary} px-3 py-1.5`} onClick={generate}>
              <RefreshCw size={14} /> Tạo mã QR mới
            </button>
            <button type="button" className={`${btn.ghost} px-3 py-1.5 text-slate-500`} onClick={() => setPayment(null)}>
              <X size={14} /> Đóng mã QR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
