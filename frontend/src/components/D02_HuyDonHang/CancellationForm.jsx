import { useState } from 'react'

// Gợi ý nhập liệu, không phải danh sách quy tắc nghiệp vụ bắt buộc của API.
const REASONS = ['Thay đổi nhu cầu mua', 'Đặt nhầm sản phẩm', 'Muốn thay đổi cách nhận hàng', 'Khác']
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

export default function CancellationForm({ busy, onSubmit, onBack }) {
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const reason = choice === 'Khác' ? other.trim() : choice

  const prepare = (event) => {
    event.preventDefault()
    if (!reason) {
      setError('Vui lòng chọn lý do hủy đơn.')
      return
    }
    setError('')
    setConfirming(true)
  }

  if (confirming) return (
    <div role="alertdialog" aria-labelledby="cancel-confirm-title" className="mt-6 space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-5">
      <h2 id="cancel-confirm-title" className="font-bold">Xác nhận hủy đơn này?</h2>
      <p className="whitespace-pre-wrap break-words text-sm">Lý do: {reason}</p>
      <p className="text-sm text-slate-600">Máy chủ sẽ kiểm tra lại trạng thái đơn và thanh toán trước khi xử lý.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => onSubmit(reason)} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác nhận hủy đơn'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold">Quay lại</button>
      </div>
    </div>
  )

  return (
    <form onSubmit={prepare} noValidate className="mt-6 space-y-4">
      <div className="space-y-2 text-sm font-semibold">
        <label htmlFor="cancel-reason">Lý do hủy đơn *</label>
        <select id="cancel-reason" value={choice} onChange={event => { setChoice(event.target.value); setError('') }} className={fieldClass} disabled={busy} aria-describedby={error ? 'cancel-reason-error' : undefined} aria-invalid={Boolean(error)}>
          <option value="">Chọn lý do</option>
          {REASONS.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      {choice === 'Khác' && <div className="space-y-2 text-sm font-semibold">
        <label htmlFor="cancel-other-reason">Lý do khác *</label>
        <textarea id="cancel-other-reason" rows={4} maxLength={500} value={other} onChange={event => setOther(event.target.value)} className={fieldClass} disabled={busy} />
        <span className="block text-xs font-normal text-slate-500">{other.length}/500 ký tự</span>
      </div>}
      {error && <p id="cancel-reason-error" role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Tiếp tục hủy đơn</button>
        <button type="button" disabled={busy} onClick={onBack} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Quay lại</button>
      </div>
    </form>
  )
}
