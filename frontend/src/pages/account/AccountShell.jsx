import { NavLink, Outlet } from 'react-router-dom'
import Header from '../../components/Header'
import DevAccountSwitcher from '../../components/DevAccountSwitcher'
import { Loading } from '../../components/admin/AdminUi'
import { useDevAccount } from '../../hooks/useDevAccount'

const LINKS = [
  { to: '/reports', label: 'Báo cáo của tôi' },
  { to: '/refunds', label: 'Hoàn tiền' },
  { to: '/seller/fees', label: 'Phí & hoa hồng (người bán)' },
]

// Khung cho các trang phân hệ B phía người dùng: báo cáo vi phạm, hoàn tiền, phí người bán.
export default function AccountShell() {
  const { userId, me, loading } = useDevAccount()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header savedCount={0} onShowSaved={() => {}} onUnavailable={() => {}} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
          <DevAccountSwitcher compact />
        </div>
        {userId && loading ? (
          <Loading />
        ) : me ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-slate-900">Vui lòng chọn tài khoản</p>
            <p className="mt-1 text-sm text-slate-500">Nhập mã tài khoản thử nghiệm để tiếp tục (tạm thay đăng nhập cho tới khi hoàn thiện A02).</p>
            <div className="mt-4 flex justify-center">
              <DevAccountSwitcher />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
