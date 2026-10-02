import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2 } from 'lucide-react'
import { buildVietQrPayload } from '../lib/vietqr'

// Mã QR chuyển khoản VietQR tự sinh trên trình duyệt (không cần dịch vụ ngoài).
export default function VietQrCode({ bankCode, accountNumber, amount, content, size = 192, className = '' }) {
  const payload = bankCode && accountNumber ? buildVietQrPayload({ bankCode, accountNumber, amount, content }) : ''
  const [image, setImage] = useState({ payload: '', src: '' })

  useEffect(() => {
    if (!payload) return undefined
    let cancelled = false
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: size * 2 }).then((src) => {
      if (!cancelled) setImage({ payload, src })
    })
    return () => {
      cancelled = true
    }
  }, [payload, size])

  if (!payload) return null
  const ready = image.payload === payload
  return (
    <div className={`grid place-items-center rounded-lg border border-slate-200 bg-white ${className}`} style={{ width: size, height: size }}>
      {ready ? (
        <img src={image.src} alt="Mã QR chuyển khoản VietQR" width={size} height={size} className="rounded-lg" />
      ) : (
        <Loader2 className="animate-spin text-emerald-600" />
      )}
    </div>
  )
}
