import { InfoRow, Modal, StatusBadge } from './AdminUi'
import QrPaymentPanel from '../QrPaymentPanel'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { COMMISSION_STATUS } from '../../lib/labels'

// Chi tiết một khoản hoa hồng: cách tính và số tiền trước/sau điều chỉnh do hoàn tiền.
// canPay: chỉ người bán (chủ khoản phí) mới thấy nút Thanh toán.
export default function CommissionDetail({ commission, statusMap = COMMISSION_STATUS, onClose, footer, canPay = false }) {
  const orderValue = Number(commission.Order?.ProductAmount || 0)
  const rate = Number(commission.Rate)
  const adjusted = Number(commission.AdjustmentAmount) !== 0
  const amountDue = Math.round(Number(commission.AmountDue))
  // Chưa thanh toán (Chưa nộp / Đã điều chỉnh) thì mới có nút Thanh toán.
  const payable = ['UNPAID', 'ADJUSTED'].includes(commission.Status)

  return (
    <Modal open title={`Hoa hồng đơn #${commission.OrderId}`} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cách tính</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatMoney(orderValue)} × {rate}% = {formatMoney(commission.OriginalAmount)}
          </p>
          <p className="text-xs text-slate-500">Giá trị đơn × tỷ lệ đã lưu trên đơn = số tiền hoa hồng</p>
        </div>

        {adjusted && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
            <p className="font-semibold text-violet-800">Đã điều chỉnh do hoàn tiền</p>
            <p className="mt-1 tabular-nums">
              Trước: <b>{formatMoney(commission.OriginalAmount)}</b> → Sau: <b>{formatMoney(commission.AmountDue)}</b>
              <span className="text-slate-500"> (điều chỉnh {formatMoney(commission.AdjustmentAmount)})</span>
            </p>
          </div>
        )}

        {canPay && payable && amountDue > 0 && (
          <QrPaymentPanel payment={{ type: 'fee', commissionIds: [commission.CommissionId] }} amount={amountDue} reference={commission.PaymentReference} title={`Nộp hoa hồng đơn #${commission.OrderId}`} />
        )}
        {payable && amountDue === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Số tiền phải nộp là 0đ nên khoản này không cần chuyển khoản.</p>
        )}

        <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          <InfoRow label="Trạng thái"><StatusBadge map={statusMap} value={commission.Status} /></InfoRow>
          <InfoRow label="Sản phẩm">{commission.Order?.Listing?.Title}</InfoRow>
          {commission.Seller && <InfoRow label="Người bán">{commission.Seller.FullName}</InfoRow>}
          <InfoRow label="Số tiền phải nộp"><b>{formatMoney(commission.AmountDue)}</b></InfoRow>
          <InfoRow label="Mã đối soát"><span className="font-mono">{commission.PaymentReference}</span></InfoRow>
          <InfoRow label="Hạn nộp">{formatDate(commission.DueAt)}</InfoRow>
          {commission.PaymentTransactionCode && (
            <InfoRow label="Mã giao dịch người bán nhập"><span className="font-mono">{commission.PaymentTransactionCode}</span></InfoRow>
          )}
          {commission.PaymentProofUrl && (
            <InfoRow label="Ảnh chuyển khoản">
              <a href={commission.PaymentProofUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Xem ảnh</a>
            </InfoRow>
          )}
          {commission.ReportedAt && <InfoRow label="Báo nộp lúc">{formatDateTime(commission.ReportedAt)}</InfoRow>}
          {commission.ConfirmedAt && (
            <InfoRow label="Xác nhận thu">{formatDateTime(commission.ConfirmedAt)}{commission.Confirmer ? ` · ${commission.Confirmer.FullName}` : ''}</InfoRow>
          )}
        </dl>
      </div>
    </Modal>
  )
}
