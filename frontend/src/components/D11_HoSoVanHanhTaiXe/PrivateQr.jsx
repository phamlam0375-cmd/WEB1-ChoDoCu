import { useEffect, useState } from 'react'
import { getDriverQr } from '../../services/D11_HoSoVanHanhTaiXe/profileApi'
export default function PrivateQr({ url, file }) {
  const [result, setResult] = useState({ src: '', error: '' })
  useEffect(() => {
    const controller = new AbortController()
    let src
    async function load() {
      try {
        const blob = file || (url ? await getDriverQr(url, controller.signal) : null)
        if (controller.signal.aborted) return
        src = blob ? URL.createObjectURL(blob) : ''
        setResult({ src, error: '' })
      } catch { if (!controller.signal.aborted) setResult({ src: '', error: 'Không tải được QR riêng tư. Hãy tải lại hồ sơ.' }) }
    }
    load()
    return () => { controller.abort(); if (src) URL.revokeObjectURL(src) }
  }, [url, file])
  if (result.error) return <p role="alert">{result.error}</p>
  return result.src ? <img className="my-3 max-h-64 max-w-full rounded-lg border" src={result.src} alt="QR nhận phí của bạn" /> : null
}
