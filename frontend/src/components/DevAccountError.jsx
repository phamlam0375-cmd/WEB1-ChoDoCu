import { AlertTriangle } from 'lucide-react'

// Giải thích lỗi khi chọn tài khoản thử nghiệm và cách khắc phục, thay vì chỉ báo "chọn tài khoản".
const HINTS = [
  [/không kết nối được máy chủ|không gọi được api/i, 'Backend chưa chạy hoặc không gọi được. Mở Docker Desktop, chạy "docker compose up -d", rồi mở /api/health để kiểm tra. Nếu đang dùng cổng 5173 thì tắt và chạy lại "pnpm dev".'],
  [/lỗi server/i, 'Database chưa sẵn sàng. Chờ API chạy xong migration (xem "docker compose logs -f api") rồi thử lại; vẫn lỗi thì chạy "docker compose down -v" rồi "docker compose up -d --build".'],
  [/không tồn tại/i, 'Mã tài khoản này không có trong database. Thử mã 2 (quản trị viên trong dữ liệu mẫu).'],
  [/bị khóa/i, 'Tài khoản đang bị khóa. Dùng một tài khoản quản trị khác để mở khóa.'],
]

export default function DevAccountError({ error }) {
  if (!error) return null
  const hint = HINTS.find(([pattern]) => pattern.test(error))?.[1]
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-800" role="alert">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
      </p>
      {hint && <p className="mt-1 pl-6 text-xs text-red-700">{hint}</p>}
    </div>
  )
}
