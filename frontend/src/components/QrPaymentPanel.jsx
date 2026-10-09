import { ExternalLink, QrCode } from 'lucide-react'
import { btn } from './admin/styles'
import { formatMoney } from '../lib/format'

// Nút "Thanh toán": mở trang thanh toán (mã QR MoMo giả lập) ở tab mới.
// payment = { type: 'fee', commissionIds: [..] } | { type: 'refund', refundId }
// reference là nội dung chuyển tiền: mã đối soát khi nộp phí, mã yêu cầu khi chuyển trả hoàn tiền.
export default function QrPaymentPanel({ payment, amount, reference, buttonLabel = 'Thanh toán', title }) {
  const params = new URLSearchParams({ type: payment.type, amount: String(amount), ref: reference || '' })
  if (payment.type === 'fee') params.set('ids', payment.commissionIds.join(','))
  if (payment.type === 'refund') params.set('id', String(payment.refundId))
  if (title) params.set('title', title)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3">
      <p className="text-sm text-slate-700">
        Cần thanh toán <b className="text-emerald-700">{formatMoney(amount)}</b>
      </p>
      <a href={`/payment?${params}`} target="_blank" rel="noopener" className={btn.primary}>
        <QrCode size={16} /> {buttonLabel} <ExternalLink size={14} />
      </a>
    </div>
  )
}
