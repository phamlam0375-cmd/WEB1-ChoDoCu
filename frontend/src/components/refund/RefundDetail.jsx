import { useState } from 'react'
import { toast } from 'react-toastify'
import { ConfirmDialog, InfoRow, Loading, Modal, StatusBadge } from '../admin/AdminUi'
import { btn } from '../admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { ORDER_STATUS, REFUND_STATUS } from '../../lib/labels'

// Chi tiết và tiến độ yêu cầu hoàn tiền; quản trị bấm Tiếp nhận để chuyển sang Đang xem xét.
// Thao tác của từng vai trò: viewer = 'admin' | 'buyer' | 'seller'.
const ACTIONS = {
  REVIEW: { viewer: 'admin', from: ['PENDING'], label: 'Tiếp nhận', style: btn.primary, message: 'Yêu cầu sẽ chuyển sang "Đang xem xét".' },
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

  const rule = ACTIONS[action]
  const available = refund ? Object.entries(ACTIONS).filter(([, item]) => item.viewer === viewer && item.from.includes(refund.Status)) : []

  const openAction = (key) => setAction(key)

  const submit = async (note) => {
    const body = { action, note: note || undefined, expectedStatus: refund.Status }
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
        message={rule?.message}
      />
    </Modal>
  )
}
