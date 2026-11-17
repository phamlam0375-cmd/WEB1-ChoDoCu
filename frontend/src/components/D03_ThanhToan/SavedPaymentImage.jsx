import { useState } from 'react'
export default function SavedPaymentImage({ url, alt, kind = 'biên lai' }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = attempt ? `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}` : url
  return <div className="mt-4">
    {failed ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>Không tải được ảnh {kind}. Kiểm tra kết nối hoặc liên hệ bên cung cấp ảnh để xác minh.</p>
      <button type="button" className="mt-3 rounded-lg border border-rose-300 px-3 py-2 font-semibold" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>Tải lại ảnh {kind}</button>
    </div> : <img key={attempt} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-72 max-w-full rounded-xl border border-slate-200 object-contain" />}
  </div>
}
