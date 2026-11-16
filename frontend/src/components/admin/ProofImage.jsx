import { useState } from 'react'

// Ảnh chứng từ / bằng chứng: xem ngay trong trang, bấm để mở ảnh gốc.
// File không tồn tại (ví dụ dữ liệu mẫu) thì báo rõ thay vì hiện ảnh vỡ hoặc mở ra trang chủ.
export default function ProofImage({ url, alt = 'Ảnh', className = 'max-h-48' }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span className="text-sm text-slate-500">Không tải được ảnh (file không còn trên máy chủ)</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Mở ảnh gốc" className="inline-block">
      <img src={url} alt={alt} className={`${className} rounded-lg border border-slate-200 object-contain`} onError={() => setBroken(true)} />
    </a>
  )
}
