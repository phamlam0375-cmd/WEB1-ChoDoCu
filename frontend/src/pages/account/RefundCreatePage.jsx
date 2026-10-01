import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Card, Field, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'

// B06: người mua gửi yêu cầu hoàn tiền cho một đơn (/orders/:orderId/refund).
// Trang theo dõi đơn của D chỉ cần đặt nút dẫn tới đường dẫn này.
export default function RefundCreatePage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { busy, run } = useMutation()
  const [form, setForm] = useState({ reason: '', amount: '', evidenceUrl: '' })
  const [errors, setErrors] = useState({})

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (form.reason.trim().length < 10) next.reason = 'Vui lòng mô tả lý do (ít nhất 10 ký tự)'
    if (form.amount && (!/^\d+$/.test(form.amount) || Number(form.amount) <= 0)) next.amount = 'Số tiền phải là số nguyên dương'
    if (form.evidenceUrl.trim() && !/^(https?:\/\/|\/)\S+$/i.test(form.evidenceUrl.trim())) next.evidenceUrl = 'Đường dẫn phải bắt đầu bằng http(s):// hoặc /'
    setErrors(next)
    if (Object.keys(next).length) return

    try {
      const result = await run('post', `/orders/${orderId}/refund-requests`, {
        reason: form.reason.trim(),
        amount: form.amount ? Number(form.amount) : undefined,
        evidenceUrl: form.evidenceUrl.trim() || undefined,
      })
      toast.success(result.message)
      navigate('/refunds')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        code="B06"
        title={`Yêu cầu hoàn tiền cho đơn #${orderId}`}
        description="Quản trị viên xem xét yêu cầu; nếu được duyệt, người bán chuyển trả trực tiếp cho bạn. Phí giao hàng đã trả cho tài xế không nằm trong khoản hoàn."
      />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Lý do hoàn tiền *" hint={`${form.reason.length}/500`} error={errors.reason}>
            <textarea rows={4} maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className={input} />
          </Field>
          <Field label="Số tiền đề nghị hoàn (đồng)" hint="Để trống để yêu cầu hoàn toàn bộ tiền sản phẩm." error={errors.amount}>
            <input inputMode="numeric" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.trim() })} className={input} />
          </Field>
          <Field label="Đường dẫn bằng chứng" hint="Ảnh sản phẩm lỗi, video mở hộp..." error={errors.evidenceUrl}>
            <input value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} className={input} placeholder="https://" />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className={btn.primary} disabled={busy}>Gửi yêu cầu</button>
          </div>
        </form>
      </Card>
    </>
  )
}
