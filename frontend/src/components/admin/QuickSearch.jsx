import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'

// Tìm kiếm nhanh trên thanh tiêu đề trang quản trị: gõ tên, email, mã số, tiêu đề tin, mã đối soát…
// Bấm kết quả để mở trang tương ứng, đã lọc sẵn theo từ khóa.
const GROUPS = [
  { key: 'users', title: 'Tài khoản', path: '/admin/users', query: (item) => item.Email, label: (item) => item.FullName, sub: (item) => `#${item.UserId} · ${item.Email}` },
  { key: 'listings', title: 'Tin đăng', path: '/admin/listings', query: (item) => String(item.ListingId), label: (item) => item.Title, sub: (item) => `#${item.ListingId} · ${formatMoney(item.Price)}` },
  { key: 'reports', title: 'Báo cáo vi phạm', path: '/admin/reports', query: (item) => String(item.ReportId), label: (item) => item.Reason, sub: (item) => `#${item.ReportId}` },
  { key: 'commissions', title: 'Khoản phí', path: '/admin/commissions', query: (item) => item.PaymentReference, label: (item) => item.PaymentReference, sub: (item) => `Đơn #${item.OrderId} · ${formatMoney(item.AmountDue)}` },
]

export default function QuickSearch() {
  const navigate = useNavigate()
  const box = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState({ q: '', data: null })

  // Gõ xong 300ms mới gọi API để không gửi quá nhiều yêu cầu.
  useEffect(() => {
    const keyword = q.trim()
    if (!keyword) return undefined
    let active = true
    const timer = setTimeout(() => {
      api
        .get('/admin/search', { params: { q: keyword } })
        .then((res) => active && setResult({ q: keyword, data: res.data.data }))
        .catch(() => active && setResult({ q: keyword, data: null }))
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q])

  // Bấm ra ngoài thì đóng danh sách kết quả.
  useEffect(() => {
    const close = (event) => {
      if (box.current && !box.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (path, keyword) => {
    setOpen(false)
    setQ('')
    navigate(`${path}?q=${encodeURIComponent(keyword)}`)
  }

  const keyword = q.trim()
  const data = result.q === keyword ? result.data : null
  const total = data ? GROUPS.reduce((sum, group) => sum + (data[group.key]?.length || 0), 0) : 0

  return (
    <div ref={box} className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(event) => {
          setQ(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="Tìm tài khoản, tin, báo cáo, mã phí…"
        aria-label="Tìm kiếm nhanh"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
      />
      {open && keyword && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {!data ? (
            <p className="px-3 py-2 text-sm text-slate-500">Đang tìm…</p>
          ) : total === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Không tìm thấy kết quả cho "{keyword}"</p>
          ) : (
            GROUPS.filter((group) => data[group.key]?.length).map((group) => (
              <div key={group.key} className="py-1">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
                {data[group.key].map((item) => (
                  <button
                    key={group.sub(item)}
                    type="button"
                    onClick={() => go(group.path, group.query(item))}
                    className="block w-full px-3 py-1.5 text-left hover:bg-emerald-50"
                  >
                    <span className="block truncate text-sm font-medium text-slate-900">{group.label(item)}</span>
                    <span className="block truncate text-xs text-slate-500">{group.sub(item)}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
