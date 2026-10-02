import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'

const ACCEPTED = ['image/jpeg', 'image/png']
const MAX_BYTES = 5 * 1024 * 1024
const INVALID_IMAGE_MESSAGE = 'Chỉ chấp nhận ảnh JPG, PNG, tối đa 5MB'

// Chọn ảnh bằng chứng: kiểm tra định dạng, dung lượng rồi tải lên máy chủ, trả về đường dẫn ảnh.
export default function ImageUpload({ value, onChange, label = 'Ảnh bằng chứng' }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type) || file.size > MAX_BYTES) {
      setError(INVALID_IMAGE_MESSAGE)
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await api.post('/uploads', file, { headers: { 'Content-Type': file.type } })
      onChange(res.data.data.url)
    } catch (err) {
      setError(errorMessage(err, INVALID_IMAGE_MESSAGE))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-28 rounded-lg border border-slate-200 object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-slate-900 text-white"
            aria-label="Bỏ ảnh"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-5 text-sm text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          {busy ? <Loader2 size={20} className="animate-spin text-emerald-600" /> : <ImagePlus size={20} className="text-emerald-600" />}
          {busy ? 'Đang tải ảnh...' : 'Chọn ảnh JPG, PNG (tối đa 5MB)'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={pick} className="hidden" />
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </div>
  )
}
