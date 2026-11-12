import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/profile', label: 'Hồ sơ cá nhân' },
  { to: '/orders', label: 'Đơn mua của tôi' },
  { to: '/reports', label: 'Báo cáo của tôi' },
  { to: '/refunds', label: 'Hoàn tiền' },
  { to: '/seller/fees', label: 'Phí & hoa hồng (người bán)' },
  { to: '/seller/payments', label: 'Xác nhận nhận tiền' },
  { to: '/credit/packages', label: 'Mua Credit' },
]

export default function AccountNavigation() {
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Tài khoản">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-white'}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
