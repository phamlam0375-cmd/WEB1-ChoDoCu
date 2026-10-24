import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

export default function ReceiptUpload({ onChange, disabled }) {
  const input = useRef(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const choose = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError('Chỉ chấp nhận ảnh JPG, PNG, tối đa 5MB')
      return
    }
    setError('')
    setPreview(URL.createObjectURL(file))
    onChange(file)
  }

  const remove = () => { setPreview(''); setError(''); onChange(null) }

  return <div className="mt-6">
    <label htmlFor="d03-proof" className="block text-sm font-bold">Biên lai chuyển khoản *</label>
    <p className="mt-1 text-xs text-slate-500">JPG/PNG, tối đa 5 MB. Ảnh chỉ được tải lên khi gửi thông báo.</p>
    {preview && <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <img src={preview} alt="Xem trước biên lai" className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
      <button type="button" disabled={disabled} onClick={remove} className="mt-3 flex items-center gap-1 text-sm font-bold text-rose-700 disabled:opacity-50"><X size={16} /> Bỏ ảnh biên lai</button>
    </div>}
    <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 disabled:opacity-50"><ImagePlus size={18} />{preview ? 'Đổi ảnh biên lai' : 'Chọn ảnh biên lai'}</button>
    <input ref={input} id="d03-proof" type="file" accept="image/jpeg,image/png" onChange={choose} disabled={disabled} className="sr-only" />
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
  </div>
}
