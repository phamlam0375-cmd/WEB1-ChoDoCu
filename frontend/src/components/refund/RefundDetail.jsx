import { useState } from 'react'
import { toast } from 'react-toastify'
import { ConfirmDialog, Field, InfoRow, Loading, Modal, StatusBadge } from '../admin/AdminUi'
import { btn, input } from '../admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { ORDER_STATUS, REFUND_STATUS } from '../../lib/labels'

// Thao tác của từng vai trò: viewer = 'admin' | 'buyer' | 'seller'.
const ACTIONS = {
  APPROVE: { viewer: 'admin', from: 'PENDING', label: 'Duyệt hoàn tiền', style: btn.primary, reason: 'Ghi chú cho hai bên', required: false },
  REJECT: { viewer: 'admin', from: 'PENDING', label: 'Từ chối', style: btn.danger, reason: 'Lý do từ chối', required: true, tone: 'danger' },
  ADMIN_COMPLETE: { viewer: 'admin', from: 'SELLER_TRANSFERRED', label: 'Xác nhận đã hoàn xong', style: btn.secondary, reason: 'Căn cứ xác nhận (đã kiểm tra chứng từ)', required: true },
  SELLER_TRANSFERRED: { viewer: 'seller', from: 'APPROVED', label: 'Báo đã chuyển trả', style: btn.primary },
  CONFIRM_RECEIVED: { viewer: 'buyer', from: 'SELLER_TRANSFERRED', label: 'Tôi đã nhận được tiền', style: btn.primary },
  NOT_RECEIVED: { viewer: 'buyer', from: 'SELLER_TRANSFERRED', label: 'Chưa nhận được', style: btn.secondary, reason: 'Mô tả vấn đề', required: true, tone: 'danger' },
}

const STEP_LABELS = {
  'REFUND:PENDING': 'Người mua gửi yêu cầu',
  'REFUND:APPROVED': 'Được duyệt, chờ người bán chuyển trả',
  'REFUND:REJECTED': 'Bị từ chối',
  'REFUND:SELLER_TRANSFERRED': 'Người bán báo đã chuyển trả',
  'REFUND:COMPLETED': 'Hoàn tiền hoàn tất',
}

export default function RefundDetail({ id, viewer, onClose, onSaved }) {
  const { data: refund, loading, error, reload } = useApi(`/refund-requests/${id}`)
  const { busy, run } = useMutation()
  const [action, setAction] = useState(null)
  const [amount, setAmount] = useState('')
  const [proofUrl, setProofUrl] = useState('')

  const rule = ACTIONS[action]
  const available = refund ? Object.entries(ACTIONS).filter(([, item]) => item.viewer === viewer && item.from === refund.Status) : []

  const openAction = (key) => {
    setAmount(refund ? String(Math.round(Number(refund.Amount))) : '')
    setProofUrl('')
    setAction(key)
  }

  const submit = async (note) => {
    const body = { action, note: note || undefined }
    if (action === 'APPROVE' && Number(amount) !== Math.round(Number(refund.Amount))) body.amount = Number(amount)
    if (action === 'SELLER_TRANSFERRED') body.refundProofUrl = proofUrl.trim()
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
    <Modal open title={`Yêu cầu hoàn tiền #${id}`} onClose={onClose} size="max-w-2xl">
      {loading && !refund ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge map={REFUND_STATUS} value={refund.Status} />
            <span className="text-2xl font-bold tabular-nums text-slate-900">{formatMoney(refund.Amount)}</span>
            <span className="text-sm text-slate-500">/ giá sản phẩm {formatMoney(order.ProductAmount)}</span>
          </div>

          <dl className="divide-y divide-slate-100">
            <InfoRow label="Đơn hàng">
              #{order.OrderId} · {order.Listing?.Title} · {ORDER_STATUS[order.Status] || order.Status}
            </InfoRow>
            <InfoRow label="Người mua">{refund.Requester?.FullName} · {refund.Requester?.Phone || refund.Requester?.Email}</InfoRow>
            <InfoRow label="Người bán">{order.Seller?.FullName} · {order.Seller?.Phone || order.Seller?.Email}</InfoRow>
            <InfoRow label="Lý do">{refund.Reason}</InfoRow>
            <InfoRow label="Bằng chứng">
              {refund.EvidenceUrl ? <a className="text-emerald-700 underline" href={refund.EvidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng</a> : '—'}
            </InfoRow>
            {refund.AdminNote && <InfoRow label="Kết luận quản trị">{refund.AdminNote}</InfoRow>}
            {refund.RefundProofUrl && (
              <InfoRow label="Chứng từ chuyển trả">
                <a className="text-emerald-700 underline" href={refund.RefundProofUrl} target="_blank" rel="noreferrer">Mở chứng từ</a>
              </InfoRow>
            )}
          </dl>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Tiến độ</p>
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

          {viewer === 'seller' && refund.Status === 'APPROVED' && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Vui lòng chuyển trả <b>{formatMoney(refund.Amount)}</b> trực tiếp cho người mua, sau đó báo đã chuyển kèm ảnh chứng từ.
            </p>
          )}

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
        busy={busy}
        onConfirm={(note) => {
          if (action === 'SELLER_TRANSFERRED' && !proofUrl.trim()) {
            toast.error('Vui lòng nhập đường dẫn ảnh chứng từ chuyển trả')
            return
          }
          submit(note)
        }}
        onClose={() => setAction(null)}
        message={
          action === 'CONFIRM_RECEIVED'
            ? `Xác nhận bạn đã nhận đủ ${formatMoney(refund?.Amount)}. Đơn hàng sẽ chuyển sang Đã hoàn tiền.`
            : action === 'ADMIN_COMPLETE'
              ? 'Chỉ dùng khi người mua không phản hồi nhưng chứng từ chuyển trả hợp lệ.'
              : null
        }
      >
        {action === 'APPROVE' && (
          <Field className="mt-3" label="Số tiền hoàn (đồng)" hint={`Có thể giảm so với đề nghị ${formatMoney(refund?.Amount)}; không vượt tiền sản phẩm.`}>
            <input type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} className={input} />
          </Field>
        )}
        {action === 'SELLER_TRANSFERRED' && (
          <Field className="mt-3" label="Đường dẫn ảnh chứng từ chuyển trả *" hint="Ảnh chụp giao dịch ngân hàng, dạng https://... hoặc /uploads/...">
            <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} className={input} placeholder="https://" />
          </Field>
        )}
      </ConfirmDialog>
    </Modal>
  )
}
