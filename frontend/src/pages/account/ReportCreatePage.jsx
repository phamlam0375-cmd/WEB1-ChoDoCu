import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Flag } from 'lucide-react'
import { Card, Field, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import ImageUpload from '../../components/ImageUpload'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { REPORT_TARGET } from '../../lib/labels'

// Biểu mẫu gửi báo cáo vi phạm. Có thể mở sẵn đối tượng qua
// /reports/new?targetType=LISTING&targetId=12 (nút "Báo cáo" ở trang tin đăng).
export default function ReportCreatePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: reasons } = useApi('/reports/reasons')
  const { busy, run } = useMutation()
  const [form, setForm] = useState({
    targetType: REPORT_TARGET[params.get('targetType')] ? params.get('targetType') : 'LISTING',
    targetId: params.get('targetId') || '',
    reason: '',
    description: '',
    evidenceUrl: '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const next = {}
    if (!/^\d+$/.test(form.targetId) || Number(form.targetId) <= 0) next.targetId = 'Vui lòng nhập mã hợp lệ'
    if (!form.reason) next.reason = 'Vui lòng chọn lý do báo cáo'
    if (form.reason === 'Khác' && !form.description.trim()) next.description = 'Vui lòng mô tả vấn đề'
    setErrors(next)
    return !Object.keys(next).length
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    try {
      const result = await run('post', '/reports', {
        targetType: form.targetType,
        targetId: Number(form.targetId),
        reason: form.reason,
        description: form.description.trim() || undefined,
        evidenceUrl: form.evidenceUrl || undefined,
      })
      toast.success(result.message)
      navigate('/reports')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Báo cáo vi phạm" description="Báo cáo tin đăng sai sự thật, tài khoản có dấu hiệu lừa đảo hoặc vấn đề trong giao dịch. Quản trị viên sẽ xem xét và thông báo kết quả." />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đối tượng bị báo cáo">
              <select value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value })} className={input}>
                {Object.entries(REPORT_TARGET).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </Field>
            <Field label={`Mã ${REPORT_TARGET[form.targetType].toLowerCase()} *`} error={errors.targetId}>
              <input inputMode="numeric" value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value.trim() })} className={input} />
            </Field>
          </div>
          <Field label="Lý do *" error={errors.reason}>
            <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className={input}>
              <option value="">Chọn lý do</option>
              {reasons?.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </Field>
          <Field label={`Mô tả chi tiết${form.reason === 'Khác' ? ' *' : ''}`} hint={`${form.description.length}/1000`} error={errors.description}>
            <textarea rows={4} maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={input} />
          </Field>
          <ImageUpload label="Ảnh bằng chứng (không bắt buộc)" value={form.evidenceUrl} onChange={(evidenceUrl) => setForm({ ...form, evidenceUrl })} />
          <div className="flex justify-end">
            <button type="submit" className={btn.primary} disabled={busy}>
              <Flag size={16} /> Gửi báo cáo
            </button>
          </div>
        </form>
      </Card>
    </>
  )
}
