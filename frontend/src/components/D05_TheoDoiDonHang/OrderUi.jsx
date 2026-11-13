import { useEffect, useId, useRef } from 'react'
import { X, Route } from 'lucide-react'
import { Card as BaseCard } from '../admin/AdminUi'
import './orderWorkspace.css'
import { btn } from '../admin/styles'
import { keepDialogFocus } from './dialogFocus'
export { Badge, StatusBadge, StatusTabs, FilterBar, Field, SearchInput, DataTable, Pagination, Loading, ErrorState, EmptyState, Section } from '../admin/AdminUi'

export function Card({ className = '', children }) {
  return <BaseCard className={`d-card ${className}`}>{children}</BaseCard>
}
export function PageHeader({ code, title, description, actions }) {
  return <section className="d-page-heading mb-5 flex flex-col gap-5 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
    <div className="flex min-w-0 items-start gap-4"><span className="d-heading-icon grid size-11 shrink-0 place-items-center rounded-xl"><Route size={23} /></span><div className="min-w-0">
      <p className="d-eyebrow text-xs font-bold uppercase tracking-wider">{code || 'Đơn hàng & giao nhận'}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
    </div></div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </section>
}
// Dialog chỉ dùng trong D: native focus trap và khôi phục focus, không đổi modal của B.
export function Modal({ open, title, onClose, children, footer, size = 'max-w-lg', busy = false }) {
  const ref = useRef(null), titleId = useId()
  useEffect(() => {
    if (!open) return undefined
    const element = ref.current, previous = document.activeElement
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [open])
  if (!open) return null
  return <dialog ref={ref} aria-labelledby={titleId} onKeyDown={keepDialogFocus} className={`d-workspace d-modal m-auto w-[calc(100%-2rem)] ${size} rounded-2xl border bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40`} onCancel={e => { e.preventDefault(); onClose() }}>
    <div className="d-modal-frame"><header className="d-modal-heading flex items-start justify-between gap-4 border-b px-5 py-4"><h2 id={titleId} className="text-lg font-bold">{title}</h2><button type="button" disabled={busy} className="rounded-lg p-2" onClick={onClose} aria-label="Đóng"><X size={18} /></button></header>
      <div className="min-h-0 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <footer className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-5 py-4">{footer}</footer>}
    </div>
  </dialog>
}
export function ConfirmDialog({ open, title, message, confirmText = 'Xác nhận', busy = false, onClose, onConfirm }) {
  return <Modal open={open} title={title} busy={busy} onClose={() => { if (!busy) onClose() }} footer={<>
    <button type="button" className={btn.secondary} disabled={busy} onClick={onClose}>Hủy</button>
    <button type="button" className={btn.primary} disabled={busy} onClick={onConfirm}>{busy ? 'Đang lưu…' : confirmText}</button>
  </>}><p className="text-sm leading-6 text-slate-600">{message}</p></Modal>
}
