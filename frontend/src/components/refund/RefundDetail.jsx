import { useState } from 'react'
import { toast } from 'react-toastify'
import { ConfirmDialog, Field, InfoRow, Loading, Modal, StatusBadge } from '../admin/AdminUi'
import { btn, input } from '../admin/styles'
import ImageUpload from '../ImageUpload'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { ORDER_STATUS, REFUND_STATUS } from '../../lib/labels'
import QrPaymentPanel from '../QrPaymentPanel'

// Thao tác của từng vai trò: viewer = 'admin' | 'buyer' | 'seller'.
const ACTIONS = {
  REVIEW: { viewer: 'admin', from: ['PENDING'], label: 'Tiếp nhận', style: btn.primary, message: 'Yêu cầu sẽ chuyển sang "Đang xem xét".' },
  APPROVE: { viewer: 'admin', from: ['PENDING', 'REVIEWING', 'DISPUTED'], label: 'Chấp nhận hoàn tiền', style: btn.primary, reason: 'Ghi chú (không bắt buộc)', message: 'Yêu cầu sẽ chuyển sang "Chờ người bán chuyển trả", người bán nhận thông báo.' },
  REJECT: { viewer: 'admin', from: ['PENDING', 'REVIEWING', 'DISPUTED'], label: 'Từ chối', style: btn.danger, reason: 'Lý do từ chối', required: true, empty: 'Vui lòng nhập lý do từ chối', tone: 'danger' },
  ADMIN_COMPLETE: { viewer: 'admin', from: ['SELLER_TRANSFERRED', 'DISPUTED'], label: 'Xác nhận đã hoàn xong', style: btn.secondary, reason: 'Căn cứ xác nhận', required: true },
  SELLER_RESPOND: { viewer: 'seller', from: ['PENDING', 'REVIEWING'], label: 'Gửi phản hồi', style: btn.secondary, reason: 'Nội dung phản hồi', required: true, empty: 'Vui lòng nhập nội dung phản hồi' },
  SELLER_TRANSFERRED: { viewer: 'seller', from: ['APPROVED'], label: 'Báo đã chuyển trả', style: btn.primary },
  CONFIRM_RECEIVED: { viewer: 'buyer', from: ['SELLER_TRANSFERRED'], label: 'Đã nhận tiền', style: btn.primary },
  NOT_RECEIVED: { viewer: 'buyer', from: ['SELLER_TRANSFERRED'], label: 'Chưa nhận được', style: btn.secondary, reason: 'Mô tả vấn đề (không bắt buộc)', tone: 'danger', message: 'Yêu cầu sẽ chuyển lại cho quản trị xem xét.' },
}

const STEP_LABELS = {
  'REFUND:PENDING': 'Người mua gửi yêu cầu',
  'REFUND:REVIEWING': 'Quản trị tiếp nhận, đang xem xét',
  'REFUND:APPROVED': 'Chấp nhận, chờ người bán chuyển trả',
  'REFUND:REJECTED': 'Bị từ chối',
  'REFUND:SELLER_TRANSFERRED': 'Người bán báo đã chuyển trả',
  'REFUND:DISPUTED': 'Người mua báo chưa nhận được tiền',
  'REFUND:COMPLETED': 'Hoàn tiền hoàn tất',
}

export default function RefundDetail({ id, viewer, onClose, onSaved }) {
  const { data: refund, loading, error, reload } = useApi(`/refund-requests/${id}`)
  const { busy, run } = useMutation()
  const [action, setAction] = useState(null)
  const [amount, setAmount] = useState('')
  const [transfer, setTransfer] = useState({ transactionCode: '', proofUrl: '' })

  const rule = ACTIONS[action]
  const available = refund ? Object.entries(ACTIONS).filter(([, item]) => item.viewer === viewer && item.from.includes(refund.Status)) : []

  const openAction = (key) => {
    setAmount(refund ? String(Math.round(Number(refund.Amount))) : '')
    setTransfer({ transactionCode: '', proofUrl: '' })
    setAction(key)
  }

  const submit = async (note) => {
    if (action === 'SELLER_TRANSFERRED' && !transfer.transactionCode.trim() && !transfer.proofUrl) {
      toast.error('Vui lòng nhập mã giao dịch hoặc ảnh chuyển khoản')
      return
    }
    const body = { action, note: note || undefined, expectedStatus: refund.Status }
    if (action === 'APPROVE' && Number(amount) !== Math.round(Number(refund.Amount))) body.amount = Number(amount)
    if (action === 'SELLER_TRANSFERRED') {
      body.transactionCode = transfer.transactionCode.trim() || undefined
      body.refundProofUrl = transfer.proofUrl || undefined
    }
    try {
      const result = await run('patch', `/refund-requests/${id}`, body)
      toast.success(result.message)
      setAction(null)
      reload()
      onSaved?.()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const order = refund?.Order

  return (
    <Modal open title={`Yêu cầu hoàn tiền ${refund?.RefundCode || `#${id}`}`} onClose={onClose} size="max-w-2xl">
      {loading && !refund ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge map={REFUND_STATUS} value={refund.Status} />
            <span className="text-2xl font-bold tabular-nums text-slate-900">{formatMoney(refund.Amount)}</span>
            <span className="text-sm text-slate-500">/ giá trị đơn {formatMoney(order.ProductAmount)}</span>
          </div>

          <dl className="divide-y divide-slate-100">
            <InfoRow label="Đơn hàng">#{order.OrderId} · {order.Listing?.Title} · {ORDER_STATUS[order.Status] || order.Status}</InfoRow>
            <InfoRow label="Người mua">{refund.Requester?.FullName} · {refund.Requester?.Phone || refund.Requester?.Email}</InfoRow>
            <InfoRow label="Người bán">{order.Seller?.FullName} · {order.Seller?.Phone || order.Seller?.Email}</InfoRow>
            <InfoRow label="Lý do">{refund.Reason}</InfoRow>
            {refund.Description && <InfoRow label="Mô tả">{refund.Description}</InfoRow>}
            <InfoRow label="Bằng chứng">
              {refund.EvidenceUrl ? (
                <a href={refund.EvidenceUrl} target="_blank" rel="noreferrer">
                  <img src={refund.EvidenceUrl} alt="Ảnh bằng chứng" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                </a>
              ) : '—'}
            </InfoRow>
            <InfoRow label="Phản hồi người bán">{refund.SellerResponse}</InfoRow>
            {refund.AdminNote && <InfoRow label="Ghi chú xử lý">{refund.AdminNote}</InfoRow>}
            {(refund.RefundTransactionCode || refund.RefundProofUrl) && (
              <InfoRow label="Chứng từ chuyển trả">
                {refund.RefundTransactionCode && <span className="font-mono">{refund.RefundTransactionCode}</span>}{' '}
                {refund.RefundProofUrl && <a className="text-emerald-700 underline" href={refund.RefundProofUrl} target="_blank" rel="noreferrer">Xem ảnh</a>}
              </InfoRow>
            )}
          </dl>

          {viewer !== 'buyer' && ['APPROVED', 'DISPUTED'].includes(refund.Status) && refund.RefundAccountNumber && (
            <QrPaymentPanel
              account={{
                bankCode: refund.RefundBankCode,
                bankName: refund.RefundBankName,
                accountNumber: refund.RefundAccountNumber,
                accountHolder: refund.RefundAccountHolder,
              }}
              amount={Math.round(Number(refund.Amount))}
              reference={refund.RefundCode}
              buttonLabel="Chuyển trả bằng QR"
              title={`Chuyển trả ${formatMoney(refund.Amount)} cho người mua`}
            />
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Tiến độ xử lý</p>
            <ol className="relative space-y-3 border-l border-slate-200 pl-5">
              {refund.history.map((step) => (
                <li key={step.HistoryId} className="text-sm">
                  <span className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full ${step.StatusType === 'ORDER' ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                  <p className="font-medium text-slate-800">
                    {STEP_LABELS[`${step.StatusType}:${step.StatusValue}`] || `Đơn hàng: ${ORDER_STATUS[step.StatusValue] || step.StatusValue}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(step.CreatedAt)}
                    {step.Note && !ACTIONS[step.Note] ? ` · ${step.Note}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {available.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {available.map(([key, item]) => (
                <button key={key} type="button" className={item.style} onClick={() => openAction(key)}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(action)}
        title={rule?.label}
        tone={rule?.tone}
        confirmText={rule?.label}
        reasonLabel={rule?.reason}
        reasonRequired={rule?.required}
        reasonEmptyMessage={rule?.empty}
        busy={busy}
        onConfirm={submit}
        onClose={() => setAction(null)}
        message={
          action === 'CONFIRM_RECEIVED'
            ? `Xác nhận bạn đã nhận đủ ${formatMoney(refund?.Amount)}. Yêu cầu sẽ chuyển sang "Hoàn tất".`
            : rule?.message
        }
      >
        {action === 'APPROVE' && (
          <Field className="mt-3" label="Số tiền hoàn (đồng)" hint="Không vượt quá giá trị đơn hàng.">
            <input type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} className={input} />
          </Field>
        )}
        {action === 'SELLER_TRANSFERRED' && (
          <div className="mt-3 space-y-3">
            <Field label="Mã giao dịch">
              <input value={transfer.transactionCode} onChange={(event) => setTransfer({ ...transfer, transactionCode: event.target.value })} className={input} placeholder="VD: FT26100212345" />
            </Field>
            <ImageUpload label="hoặc ảnh chuyển khoản" value={transfer.proofUrl} onChange={(proofUrl) => setTransfer({ ...transfer, proofUrl })} />
          </div>
        )}
      </ConfirmDialog>
    </Modal>
  )
}
