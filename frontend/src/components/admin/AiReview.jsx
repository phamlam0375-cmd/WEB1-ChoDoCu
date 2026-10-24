import { toast } from 'react-toastify'
import { Bot, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from './AdminUi'
import { btn } from './styles'
import { useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

// B05 — Gợi ý của AI khi kiểm duyệt tin. AI chỉ gợi ý, quản trị quyết định.
const AI_RECOMMENDATION = {
  APPROVE: { label: 'Nên duyệt', tone: 'green' },
  REVIEW: { label: 'Cần xem kỹ', tone: 'amber' },
  REJECT: { label: 'Nên từ chối', tone: 'red' },
}

const RISK_LABEL = { LOW: 'Rủi ro thấp', MEDIUM: 'Rủi ro trung bình', HIGH: 'Rủi ro cao' }

const FLAG_LABEL = {
  PROHIBITED_ITEM: 'Hàng cấm',
  COUNTERFEIT: 'Nghi hàng nhái',
  SCAM: 'Dấu hiệu lừa đảo',
  CONTACT_INFO: 'Kéo giao dịch ngoài sàn',
  PRICE_ANOMALY: 'Giá bất thường',
  CATEGORY_MISMATCH: 'Sai danh mục',
  CONDITION_MISMATCH: 'Tình trạng không khớp',
  INAPPROPRIATE_CONTENT: 'Nội dung không phù hợp',
  LOW_QUALITY: 'Mô tả sơ sài',
}

// Nhãn ngắn trong bảng danh sách.
export function AiBadge({ review }) {
  if (!review) return <span className="text-xs text-slate-400">Chưa phân tích</span>
  const item = AI_RECOMMENDATION[review.recommendation]
  return (
    <span className="inline-flex items-center gap-1" title={review.summary}>
      <Bot size={14} className="text-slate-400" aria-hidden="true" />
      <Badge tone={item?.tone}>{item?.label || review.recommendation}</Badge>
    </span>
  )
}

// Khung đánh giá của AI trong chi tiết tin, kèm nút phân tích / phân tích lại.
export function AiReviewPanel({ listingId, review, configured, onDone }) {
  const { busy, run } = useMutation()

  const analyze = async () => {
    try {
      const result = await run('post', `/admin/listings/${listingId}/ai-review`)
      toast.success(result.message)
      onDone?.()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const item = review ? AI_RECOMMENDATION[review.recommendation] : null
  return (
    <div className="overflow-hidden rounded-lg border border-violet-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
          <Sparkles size={15} /> Đánh giá của AI
        </p>
        {configured && (
          <button type="button" className={`${btn.ghost} py-1`} onClick={analyze} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : review ? <RefreshCw size={14} /> : <Bot size={14} />}
            {busy ? 'Đang phân tích...' : review ? 'Phân tích lại' : 'Phân tích bằng AI'}
          </button>
        )}
      </div>
      <div className="space-y-2 px-3 py-3 text-sm">
        {!configured ? (
          <p className="text-slate-500">Chưa cấu hình AI. Thêm ANTHROPIC_API_KEY vào backend/.env để bật tính năng này.</p>
        ) : !review ? (
          <p className="text-slate-500">Tin này chưa được AI phân tích.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item?.tone}>{item?.label || review.recommendation}</Badge>
              <span className="text-xs text-slate-600">{RISK_LABEL[review.riskLevel] || review.riskLevel}</span>
              {review.flags.map((flag) => (
                <Badge key={flag} tone="slate">{FLAG_LABEL[flag] || flag}</Badge>
              ))}
            </div>
            <p className="text-slate-900">{review.summary}</p>
            {review.reasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-slate-700">
                {review.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}
            <p className="text-xs text-slate-500">
              Phân tích lúc {formatDateTime(review.reviewedAt)} · Gợi ý tham khảo, quản trị viên quyết định duyệt hay từ chối.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
