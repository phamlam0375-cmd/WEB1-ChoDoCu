import { useEffect, useId, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react'
import { btn, card, input, label as labelClass, tones } from './styles'

export function PageHeader({ code, title, description, actions }) {
  return (
    <div className={`${card} mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between`}>
      <div className="min-w-0">
        {code && <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{code}</p>}
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

// Một phần của trang trong khung riêng, có thanh tiêu đề. flush: nội dung sát viền (bảng).
export function Section({ title, meta, actions, children, flush = false, bodyClassName = 'p-4', className = '' }) {
  return (
    <section className={`${card} mb-5 overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-800">
            {title}
            {meta && <span className="ml-2 font-normal text-slate-500">{meta}</span>}
          </h2>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : bodyClassName}>{children}</div>
    </section>
  )
}

export function Card({ className = '', children }) {
  return <div className={`${card} ${className}`}>{children}</div>
}

export function Badge({ tone = 'slate', children }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  )
}

// Hiển thị trạng thái theo bảng nhãn { VALUE: { label, tone } }.
export function StatusBadge({ map, value }) {
  const item = map[value]
  return <Badge tone={item?.tone}>{item?.label || value || '—'}</Badge>
}

// Thanh chọn trạng thái kèm số lượng (counts từ API).
export function StatusTabs({ map, value, onChange, counts = {}, allLabel = 'Tất cả' }) {
  const items = [['', { label: allLabel }], ...Object.entries(map)]
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {items.map(([key, item]) => {
        const active = value === key
        const count = key ? counts[key] : total
        return (
          <button
            key={key || 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
            {count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function FilterBar({ children, onReset }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {children}
      {onReset && (
        <button type="button" onClick={onReset} className={btn.ghost}>
          Xóa lọc
        </button>
      )}
    </div>
  )
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className={labelClass}>{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

// Ô tìm kiếm: nhập từ khóa rồi bấm Tìm (hoặc Enter). Xóa trắng ô thì tự bỏ lọc.
export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', className = 'w-full sm:w-72' }) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  // Giá trị bên ngoài đổi (ví dụ bấm "Xóa lọc") thì cập nhật ô nhập theo.
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  return (
    <form
      role="search"
      className={`flex ${className}`}
      onSubmit={(event) => {
        event.preventDefault()
        onChange(draft.trim())
      }}
    >
      <input
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          if (!event.target.value && value) onChange('')
        }}
        placeholder={placeholder}
        className={`${input} rounded-r-none`}
        aria-label={placeholder}
      />
      <button type="submit" className={`${btn.primary} rounded-l-none`}>
        <Search size={16} /> Tìm
      </button>
    </form>
  )
}

export function Loading({ text = 'Đang tải...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin text-emerald-600" /> {text}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <AlertCircle className="text-red-500" />
      <p className="text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" className={btn.secondary} onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  )
}

export function EmptyState({ text = 'Không có dữ liệu phù hợp' }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-sm text-slate-500">
      <Inbox className="text-slate-300" size={32} /> {text}
    </div>
  )
}

// Bảng dữ liệu: columns = [{ key, title, render(row), className }]
export function DataTable({ columns, rows, rowKey, onRowClick, loading, error, onRetry, empty }) {
  if (loading && !rows?.length) return <Loading />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!rows?.length) return <EmptyState text={empty} />
  return (
    <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-emerald-50/70">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`whitespace-nowrap border-b-2 border-r border-emerald-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-emerald-900 last:border-r-0 ${column.className || ''}`}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`even:bg-slate-50/70 ${onRowClick ? 'cursor-pointer transition hover:bg-emerald-50/60' : ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`border-b border-r border-slate-200 px-4 py-3 align-top text-slate-700 last:border-r-0 ${column.className || ''}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? <p className="px-4 py-3 text-xs text-slate-500">{pagination.total} dòng</p> : null
  }
  const { page, totalPages, total } = pagination
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span className="text-xs text-slate-500">
        Trang {page}/{totalPages} · {total} dòng
      </span>
      <div className="flex gap-1">
        <button type="button" className={btn.secondary} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className={btn.secondary} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, size = 'max-w-lg' }) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92vh] w-full ${size} flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (!Array.isArray(footer) || footer.length > 0) && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

// Hộp xác nhận trước khi lưu, tùy chọn bắt buộc nhập lý do.
// Chỉ mount khi mở để ô lý do luôn trống ở mỗi lần mở.
export function ConfirmDialog({ open, ...props }) {
  return open ? <ConfirmDialogBody {...props} /> : null
}

function ConfirmDialogBody({
  title,
  message,
  confirmText = 'Xác nhận',
  tone = 'primary',
  reasonLabel,
  reasonRequired = false,
  reasonMin = 1,
  reasonEmptyMessage = 'Vui lòng nhập lý do',
  busy = false,
  onConfirm,
  onClose,
  children,
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = reason.trim()
  const invalid = reasonRequired ? trimmed.length < reasonMin : trimmed.length > 0 && trimmed.length < reasonMin
  const submit = () => {
    setTouched(true)
    if (!invalid) onConfirm(trimmed)
  }

  return (
    <Modal
      open
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="button" className={tone === 'danger' ? btn.danger : btn.primary} onClick={submit} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} {confirmText}
          </button>
        </>
      }
    >
      {message && <div className="text-sm text-slate-600">{message}</div>}
      {children}
      {reasonLabel && (
        <Field
          className="mt-4"
          label={`${reasonLabel}${reasonRequired ? ' *' : ''}`}
          error={touched && invalid ? (trimmed ? `Vui lòng nhập ít nhất ${reasonMin} ký tự` : reasonEmptyMessage) : null}
        >
          <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={input} maxLength={500} />
        </Field>
      )}
    </Modal>
  )
}

// Cặp nhãn - giá trị trong trang chi tiết.
export function InfoRow({ label, children }) {
  return (
    <div className="grid grid-cols-3 text-sm">
      <dt className="border-r border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-600">{label}</dt>
      <dd className="col-span-2 break-words px-3 py-2 text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

export function StatCard({ label, value, hint, tone = 'slate', icon: Icon }) {
  const iconTone = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
    </Card>
  )
}
