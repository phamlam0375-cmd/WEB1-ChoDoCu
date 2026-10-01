import { useState } from 'react'
import { toast } from 'react-toastify'
import { Info, RotateCcw, Save } from 'lucide-react'
import { Card, ConfirmDialog, ErrorState, Field, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

const displayValue = (setting, value) => {
  if (setting.type === 'text') return value
  const number = Number(value)
  return `${number.toLocaleString('vi-VN')}${setting.unit ? ` ${setting.unit}` : ''}`
}

// Kiểm tra giống backend để báo lỗi ngay khi nhập.
function validate(setting, raw) {
  const value = String(raw ?? '').trim()
  if (!value) return 'Không được để trống'
  if (setting.type === 'text') {
    const normalized = setting.key === 'FEE_BANK_ACCOUNT_HOLDER' ? value.toUpperCase().replace(/\s+/g, ' ') : value
    if (setting.minLength && normalized.length < setting.minLength) return `Tối thiểu ${setting.minLength} ký tự`
    if (setting.maxLength && normalized.length > setting.maxLength) return `Tối đa ${setting.maxLength} ký tự`
    if (setting.pattern && !new RegExp(setting.pattern).test(normalized)) return setting.patternMessage
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Phải là số'
  if (setting.type === 'integer' && !Number.isInteger(number)) return 'Phải là số nguyên'
  if (setting.type === 'decimal' && Number(number.toFixed(2)) !== number) return 'Tối đa 2 chữ số thập phân'
  if (number < setting.min || number > setting.max) {
    return `Trong khoảng ${setting.min.toLocaleString('vi-VN')} – ${setting.max.toLocaleString('vi-VN')}${setting.unit ? ` ${setting.unit}` : ''}`
  }
  return null
}

function SettingsForm({ settings, onSaved }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(settings.map((item) => [item.key, String(item.value)])))
  const [confirming, setConfirming] = useState(false)
  const { busy, run } = useMutation()

  const errors = Object.fromEntries(settings.map((item) => [item.key, validate(item, draft[item.key])]))
  const hasErrors = Object.values(errors).some(Boolean)
  const changes = settings.filter((item) => String(draft[item.key]).trim() !== String(item.value))
  const groups = [...new Set(settings.map((item) => item.group))]

  const save = async (reason) => {
    const body = Object.fromEntries(changes.map((item) => [item.key, item.type === 'text' ? draft[item.key].trim() : Number(draft[item.key])]))
    try {
      const result = await run('put', '/admin/settings', { changes: body, reason })
      toast.success(result.message)
      setConfirming(false)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!hasErrors && changes.length) setConfirming(true)
      }}
      noValidate
    >
      <div className="space-y-6">
        {groups.map((group) => {
          const items = settings.filter((item) => item.group === group)
          return (
            <Card key={group} className="p-5">
              <h2 className="mb-4 font-semibold text-slate-900">{items[0].groupLabel}</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {items.map((item) => {
                  const changed = String(draft[item.key]).trim() !== String(item.value)
                  return (
                    <Field
                      key={item.key}
                      label={
                        <span className="flex items-center gap-2">
                          {item.label}
                          {changed && <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">Đã sửa</span>}
                        </span>
                      }
                      hint={
                        <>
                          {item.description}
                          {item.updatedAt && <span className="block text-slate-400">Cập nhật {formatDateTime(item.updatedAt)}{item.updatedBy ? ` bởi ${item.updatedBy}` : ''}</span>}
                        </>
                      }
                      error={errors[item.key]}
                    >
                      <div className="flex">
                        <input
                          value={draft[item.key]}
                          onChange={(event) => setDraft({ ...draft, [item.key]: event.target.value })}
                          inputMode={item.type === 'text' ? (item.key === 'FEE_BANK_ACCOUNT_NUMBER' ? 'numeric' : 'text') : 'decimal'}
                          className={`${input} ${item.unit ? 'rounded-r-none' : ''} ${errors[item.key] ? 'border-red-400' : ''}`}
                          aria-invalid={Boolean(errors[item.key])}
                        />
                        {item.unit && (
                          <span className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                            {item.unit}
                          </span>
                        )}
                      </div>
                    </Field>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">{changes.length ? `${changes.length} thay đổi chưa lưu` : 'Không có thay đổi'}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={btn.secondary}
            disabled={!changes.length}
            onClick={() => setDraft(Object.fromEntries(settings.map((item) => [item.key, String(item.value)])))}
          >
            <RotateCcw size={16} /> Hoàn tác
          </button>
          <button type="submit" className={btn.primary} disabled={!changes.length || hasErrors}>
            <Save size={16} /> Lưu cấu hình
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Xác nhận lưu cấu hình"
        confirmText="Lưu và áp dụng"
        reasonLabel="Lý do thay đổi"
        reasonRequired
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirming(false)}
        message={
          <>
            <p>Cấu hình có hiệu lực ngay và chỉ áp cho đơn và khoản phát sinh sau khi lưu. Mỗi thay đổi được ghi vào nhật ký (B11).</p>
            <ul className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3">
              {changes.map((item) => (
                <li key={item.key}>
                  <span className="font-medium text-slate-900">{item.label}:</span>{' '}
                  <span className="text-red-700 line-through">{displayValue(item, item.value)}</span> →{' '}
                  <span className="font-semibold text-emerald-700">{displayValue(item, draft[item.key].trim())}</span>
                </li>
              ))}
            </ul>
          </>
        }
      />
    </form>
  )
}

export default function AdminSettingsPage() {
  const { data: settings, error, reload, response } = useApi('/admin/settings')
  // Đổi key sau mỗi lần tải để form lấy lại giá trị mới nhất từ máy chủ.
  const version = JSON.stringify(response?.data?.map((item) => [item.key, item.value, item.updatedAt]) || [])

  return (
    <>
      <PageHeader
        code="B12"
        title="Cấu hình quy tắc hệ thống"
        description="Các con số về hoàn tiền, hạn nộp hoa hồng, ngưỡng nợ và tài khoản nhận phí của website. Sửa ngay trên giao diện, không cần sửa file hay khởi động lại máy chủ."
      />
      <p className="mb-5 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        Đơn và khoản đã phát sinh giữ nguyên quy tắc tại thời điểm phát sinh; giá trị mới chỉ áp cho đơn/khoản sau khi lưu.
      </p>
      {error ? <ErrorState message={error} onRetry={reload} /> : !settings ? <Loading /> : <SettingsForm key={version} settings={settings} onSaved={reload} />}
    </>
  )
}
