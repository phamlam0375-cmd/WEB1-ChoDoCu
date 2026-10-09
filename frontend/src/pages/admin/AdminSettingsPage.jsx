import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Info, RotateCcw, Save } from 'lucide-react'
import { ConfirmDialog, ErrorState, Field, Loading, PageHeader, Section } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

const LEAVE_MESSAGE = 'Bạn có thay đổi chưa lưu, vẫn muốn rời trang?'

const displayValue = (setting, value) => {
  if (setting.type === 'bank') return setting.options?.find((option) => option.value === value)?.label.split(' — ')[0] || value
  if (setting.type === 'text') return value
  return `${Number(value).toLocaleString('vi-VN')}${setting.unit ? ` ${setting.unit}` : ''}`
}

// Kiểm tra giống backend để báo lỗi ngay trên giao diện.
function validate(setting, raw) {
  const value = String(raw ?? '').trim()
  if (!value) return 'Vui lòng nhập giá trị'
  if (setting.type === 'bank') return null
  if (setting.type === 'text') {
    const normalized = setting.key === 'FEE_BANK_ACCOUNT_HOLDER' ? value.toUpperCase().replace(/\s+/g, ' ') : value
    if (setting.pattern && !new RegExp(setting.pattern).test(normalized)) return setting.patternMessage
    return null
  }
  const pattern = setting.type === 'integer' ? /^-?\d+$/ : /^-?\d+([.,]\d{1,2})?$/
  const number = Number(value.replace(',', '.'))
  if (!pattern.test(value) || number < setting.min || (setting.min > 0 && number <= 0)) return setting.invalidMessage
  if (number > setting.max) {
    return setting.key === 'COMMISSION_RATE' ? setting.invalidMessage : `Tối đa ${setting.max.toLocaleString('vi-VN')} ${setting.unit}`
  }
  return null
}

// Hỏi lại khi rời trang mà còn thay đổi chưa lưu: đóng tab/tải lại và bấm liên kết trong trang.
function useLeaveGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = LEAVE_MESSAGE
    }
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!link || link.target === '_blank' || link.getAttribute('href').startsWith('#')) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    // Bắt ở pha capture để chạy trước bộ định tuyến của React.
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}

function SettingsForm({ settings, version, onSaved }) {
  const initial = () => Object.fromEntries(settings.map((item) => [item.key, String(item.value)]))
  const [draft, setDraft] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { busy, run } = useMutation()

  const errors = Object.fromEntries(settings.map((item) => [item.key, validate(item, draft[item.key])]))
  const hasErrors = Object.values(errors).some(Boolean)
  const changes = settings.filter((item) => String(draft[item.key]).trim() !== String(item.value))
  const groups = [...new Set(settings.map((item) => item.group))]
  useLeaveGuard(changes.length > 0 && !busy)

  const save = async (reason) => {
    const body = Object.fromEntries(changes.map((item) => [item.key, draft[item.key].trim()]))
    try {
      const result = await run('put', '/admin/settings', { changes: body, reason, version })
      toast.success(result.message)
      setConfirming(false)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirming(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
        if (!hasErrors && changes.length) setConfirming(true)
      }}
      noValidate
    >
      <div>
        {groups.map((group) => {
          const items = settings.filter((item) => item.group === group)
          return (
            <Section key={group} title={items[0].groupLabel} bodyClassName="p-5">
              <div className="grid gap-5 md:grid-cols-2">
                {items.map((item) => {
                  const changed = String(draft[item.key]).trim() !== String(item.value)
                  const error = (changed || submitted) && errors[item.key]
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
                      error={error}
                    >
                      {item.type === 'bank' ? (
                        <select value={draft[item.key]} onChange={(event) => setDraft({ ...draft, [item.key]: event.target.value })} className={input}>
                          {item.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : (
                        <div className="flex">
                          <input
                            value={draft[item.key]}
                            onChange={(event) => setDraft({ ...draft, [item.key]: event.target.value })}
                            inputMode={item.type === 'text' ? (item.key === 'FEE_BANK_ACCOUNT_NUMBER' ? 'numeric' : 'text') : 'decimal'}
                            className={`${input} ${item.unit ? 'rounded-r-none' : ''} ${error ? 'border-red-400' : ''}`}
                            aria-invalid={Boolean(error)}
                          />
                          {item.unit && (
                            <span className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </Field>
                  )
                })}
              </div>
            </Section>
          )
        })}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">{changes.length ? `${changes.length} thay đổi chưa lưu` : 'Không có thay đổi'}</p>
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} disabled={!changes.length} onClick={() => { setDraft(initial()); setSubmitted(false) }}>
            <RotateCcw size={16} /> Hoàn tác
          </button>
          <button type="submit" className={btn.primary} disabled={!changes.length}>
            <Save size={16} /> Lưu
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Bạn có chắc muốn lưu thay đổi?"
        confirmText="Xác nhận"
        reasonLabel="Lý do thay đổi"
        reasonRequired
        reasonMin={5}
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirming(false)}
        message={
          <>
            <ul className="space-y-1.5 rounded-lg bg-slate-50 p-3">
              {changes.map((item) => (
                <li key={item.key}>
                  <span className="font-medium text-slate-900">{item.label}:</span>{' '}
                  <span className="text-red-700 line-through">{displayValue(item, String(item.value))}</span> →{' '}
                  <span className="font-semibold text-emerald-700">{displayValue(item, draft[item.key].trim())}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">Cấu hình có hiệu lực ngay, chỉ áp cho đơn và khoản phát sinh sau khi lưu, và được ghi vào nhật ký thao tác.</p>
          </>
        }
      />
    </form>
  )
}

export default function AdminSettingsPage() {
  const { data, error, reload } = useApi('/admin/settings')

  return (
    <>
      <PageHeader
        title="Cấu hình quy tắc hệ thống"
        description="Tỷ lệ hoa hồng, phí tin VIP, thời gian giữ món, hạn yêu cầu hoàn tiền và tài khoản nhận phí của website. Sửa ngay trên giao diện, không cần khởi động lại máy chủ."
      />
      <p className="mb-5 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        Đơn và khoản đã phát sinh giữ nguyên quy tắc tại thời điểm phát sinh; giá trị mới chỉ áp cho đơn/khoản sau khi lưu.
      </p>
      {/* key = phiên bản cấu hình: sau khi lưu hoặc tải lại, form lấy giá trị mới nhất. */}
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Loading /> : <SettingsForm key={data.version} settings={data.items} version={data.version} onSaved={reload} />}
    </>
  )
}
