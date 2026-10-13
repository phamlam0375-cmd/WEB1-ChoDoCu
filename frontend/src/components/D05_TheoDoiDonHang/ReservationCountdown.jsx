import { useEffect, useRef, useState } from 'react'
import { formatDateTime } from '../../lib/format'
export default function ReservationCountdown({ deadline, serverNow, onExpire }) {
  // Thời hạn dựa trên backend; thời gian trôi đo bằng monotonic clock, không
  // phụ thuộc việc đồng hồ/ngày giờ máy người mua bị đặt sai.
  const [remaining, setRemaining] = useState(null)
  const refreshed = useRef(null)
  useEffect(() => {
    const start = performance.now(), budget = new Date(deadline).getTime() - new Date(serverNow).getTime()
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((budget - (performance.now() - start)) / 1000))
      setRemaining(seconds)
      if (seconds === 0 && refreshed.current !== deadline) { refreshed.current = deadline; onExpire() }
    }
    tick(); const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [deadline, serverNow, onExpire])
  return <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
    <p>Giữ món đến {formatDateTime(deadline)}</p>
    <p className="mt-1 font-bold">{remaining === null ? 'Đang đối chiếu thời gian…' : remaining ? `Còn ${Math.floor(remaining / 60)} phút ${remaining % 60} giây` : 'Đã đến thời hạn giữ; đang chờ trạng thái từ máy chủ.'}</p>
  </div>
}
