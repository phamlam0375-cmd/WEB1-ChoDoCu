import { useState } from 'react'
import { toast } from 'react-toastify'
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react'
import { Card, ConfirmDialog, Field, Modal, StatusBadge } from './AdminUi'
import { btn, input } from './styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { CATEGORY_STATUS } from '../../lib/labels'

function ConditionForm({ condition, onClose, onSaved }) {
  const isNew = !condition
  const [form, setForm] = useState({ Label: condition?.Label || '', Description: condition?.Description || '' })
  const [error, setError] = useState('')
  const { busy, run } = useMutation()

  const submit = async (event) => {
    event.preventDefault()
    const label = form.Label.trim().replace(/\s+/g, ' ')
    if (!label) {
      setError('Vui lòng nhập tên tình trạng')
      return
    }
    const body = { Label: label, Description: form.Description.trim() }
    try {
      const result = isNew
        ? await run('post', '/admin/conditions', body)
        : await run('patch', `/admin/conditions/${condition.ConditionCode}`, body)
      toast.success(result.message)
      onSaved()
      onClose()
    } catch (err) {
      if (err?.response?.status === 409) setError(errorMessage(err))
      else toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      title={isNew ? 'Thêm lựa chọn tình trạng' : `Sửa tình trạng "${condition.Label}"`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>Hủy</button>
          <button type="submit" form="condition-form" className={btn.primary} disabled={busy}>Lưu</button>
        </>
      }
    >
      <form id="condition-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Tên tình trạng *" hint="Ví dụ: Mới, Như mới, Đã qua sử dụng" error={error}>
          <input value={form.Label} onChange={(event) => setForm({ ...form, Label: event.target.value })} className={input} maxLength={60} autoFocus />
        </Field>
        <Field label="Mô tả" hint={`${form.Description.length}/200 ký tự`}>
          <textarea rows={2} value={form.Description} onChange={(event) => setForm({ ...form, Description: event.target.value })} className={input} maxLength={200} />
        </Field>
      </form>
    </Modal>
  )
}

// Lựa chọn tình trạng sản phẩm dùng chung cho form đăng tin, tìm kiếm và bộ lọc: thêm, sửa, ẩn/hiện.
export default function ConditionOptionsCard() {
  const { data: conditions, reload } = useApi('/admin/conditions')
  const [editing, setEditing] = useState(undefined) // undefined: đóng, null: thêm mới, object: sửa
  const [toggling, setToggling] = useState(null)
  const { busy, run } = useMutation()

  const toggle = async () => {
    try {
      await run('patch', `/admin/conditions/${toggling.ConditionCode}`, { Status: toggling.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      toast.success('Lựa chọn được cập nhật cho form đăng tin, tìm kiếm và bộ lọc')
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setToggling(null)
    }
  }

  return (
    <Card className="h-fit p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Tình trạng sản phẩm dùng chung</h2>
          <p className="mt-1 text-xs text-slate-500">Lựa chọn trong form đăng tin, tìm kiếm và bộ lọc.</p>
        </div>
        <button type="button" className={`${btn.secondary} shrink-0 px-2.5 py-1.5 text-xs`} onClick={() => setEditing(null)}>
          <Plus size={14} /> Thêm
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {conditions?.map((item) => (
          <li key={item.ConditionCode} className={`rounded-lg px-3 py-2 text-sm ${item.Status === 'ACTIVE' ? 'bg-slate-50' : 'bg-slate-50/50 opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.Label} {item.Status !== 'ACTIVE' && <StatusBadge map={CATEGORY_STATUS} value={item.Status} />}
                </p>
                {item.Description && <p className="text-xs text-slate-500">{item.Description}</p>}
                <p className="text-[11px] text-slate-400">{item.ListingCount} tin đang dùng</p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button type="button" className="rounded p-1 text-slate-400 hover:bg-white hover:text-emerald-700" onClick={() => setEditing(item)} aria-label={`Sửa ${item.Label}`} title="Sửa">
                  <Pencil size={14} />
                </button>
                <button type="button" className="rounded p-1 text-slate-400 hover:bg-white hover:text-emerald-700" onClick={() => setToggling(item)} aria-label={item.Status === 'ACTIVE' ? `Ẩn ${item.Label}` : `Hiện ${item.Label}`} title={item.Status === 'ACTIVE' ? 'Ẩn' : 'Hiện'}>
                  {item.Status === 'ACTIVE' ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {editing !== undefined && <ConditionForm condition={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.Status === 'ACTIVE' ? 'Ẩn lựa chọn tình trạng?' : 'Hiện lại lựa chọn tình trạng?'}
        message={
          toggling?.Status === 'ACTIVE'
            ? `"${toggling?.Label}" sẽ không còn trong form đăng tin và bộ lọc; ${toggling?.ListingCount || 0} tin đang dùng vẫn giữ nguyên.`
            : `"${toggling?.Label}" sẽ hiện lại trong form đăng tin và bộ lọc.`
        }
        confirmText={toggling?.Status === 'ACTIVE' ? 'Ẩn' : 'Hiện lại'}
        busy={busy}
        onConfirm={toggle}
        onClose={() => setToggling(null)}
      />
    </Card>
  )
}
