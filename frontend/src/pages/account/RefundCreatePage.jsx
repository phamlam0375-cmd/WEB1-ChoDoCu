import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Card, Field, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import ImageUpload from '../../components/ImageUpload'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'

// Người mua gửi yêu cầu hoàn tiền cho một đơn đã thanh toán (/orders/:orderId/refund).
// Trang theo dõi đơn hàng chỉ cần đặt nút "Yêu cầu hoàn tiền" dẫn tới đường dẫn này.
export default function RefundCreatePage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: reasons } = useApi('/refund-requests/reasons')
  const { data: banks } = useApi('/banks')
  const { busy, run } = useMutation()
  const [form, setForm] = useState({
    reason: '',
    description: '',
    amount: '',
    evidenceUrl: '',
    refundBankCode: '',
    refundAccountNumber: '',
    refundAccountHolder: '',
  })
  const [errors, setErrors] = useState({})
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.reason) next.reason = 'Vui lòng chọn lý do hoàn tiền'
    if (form.reason === 'Khác' && !form.description.trim()) next.description = 'Vui lòng mô tả vấn đề'
    if (form.amount && (!/^\d+$/.test(form.amount) || Number(form.amount) <= 0)) next.amount = 'Số tiền phải là số nguyên lớn hơn 0'
    if (!form.refundBankCode) next.refundBankCode = 'Vui lòng chọn ngân hàng nhận tiền hoàn'
    if (!/^\d{6,20}$/.test(form.refundAccountNumber)) next.refundAccountNumber = 'Số tài khoản ngân hàng phải gồm 6–20 chữ số'
    if (!form.refundAccountHolder.trim()) next.refundAccountHolder = 'Vui lòng nhập tên chủ tài khoản'
    setErrors(next)
    if (Object.keys(next).length) return

    try {
      const result = await run('post', `/orders/${orderId}/refund-requests`, {
        ...form,
        description: form.description.trim() || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        evidenceUrl: form.evidenceUrl || undefined,
      })
      toast.success(result.message)
      navigate('/refunds')
    } catch (err) {
      const message = errorMessage(err)
      if (message.includes('vượt quá giá trị đơn hàng')) setErrors({ amount: message })
      else toast.error(message)
    }
  }

  return (
    <>
      <PageHeader
        title={`Yêu cầu hoàn tiền cho đơn #${orderId}`}
        description="Quản trị viên xem xét yêu cầu; nếu được chấp nhận, người bán chuyển trả trực tiếp vào tài khoản của bạn. Phí giao hàng đã trả cho tài xế không nằm trong khoản hoàn."
      />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Lý do hoàn tiền *" error={errors.reason}>
            <select value={form.reason} onChange={(event) => set({ reason: event.target.value })} className={input}>
              <option value="">Chọn lý do</option>
              {reasons?.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </Field>
          <Field label={`Mô tả${form.reason === 'Khác' ? ' *' : ''}`} hint={`${form.description.length}/1000`} error={errors.description}>
            <textarea rows={3} maxLength={1000} value={form.description} onChange={(event) => set({ description: event.target.value })} className={input} />
          </Field>
          <Field label="Số tiền yêu cầu hoàn (đồng)" hint="Để trống để yêu cầu hoàn toàn bộ giá trị đơn hàng." error={errors.amount}>
            <input inputMode="numeric" value={form.amount} onChange={(event) => set({ amount: event.target.value.trim() })} className={input} />
          </Field>
          <ImageUpload value={form.evidenceUrl} onChange={(evidenceUrl) => set({ evidenceUrl })} />

          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Tài khoản nhận tiền hoàn</legend>
            <Field label="Ngân hàng *" error={errors.refundBankCode}>
              <select value={form.refundBankCode} onChange={(event) => set({ refundBankCode: event.target.value })} className={input}>
                <option value="">Chọn ngân hàng</option>
                {banks?.map((bank) => <option key={bank.code} value={bank.code}>{bank.shortName} — {bank.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Số tài khoản *" error={errors.refundAccountNumber}>
                <input inputMode="numeric" value={form.refundAccountNumber} onChange={(event) => set({ refundAccountNumber: event.target.value.trim() })} className={input} />
              </Field>
              <Field label="Chủ tài khoản *" error={errors.refundAccountHolder}>
                <input value={form.refundAccountHolder} onChange={(event) => set({ refundAccountHolder: event.target.value.toUpperCase() })} className={input} placeholder="NGUYEN VAN A" />
              </Field>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <button type="submit" className={btn.primary} disabled={busy}>Gửi yêu cầu</button>
          </div>
        </form>
      </Card>
    </>
  )
}
