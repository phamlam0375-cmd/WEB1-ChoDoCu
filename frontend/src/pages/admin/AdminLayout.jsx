import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Banknote,
  ClipboardCheck,
  FileClock,
  Flag,
  FolderTree,
  Handshake,
  Menu,
  Percent,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react'
import DevAccountSwitcher from '../../components/DevAccountSwitcher'
import DevAccountError from '../../components/DevAccountError'
import { Loading } from '../../components/admin/AdminUi'
import { useDevAccount } from '../../hooks/useDevAccount'

const NAV_GROUPS = [
  {
    title: 'Tổng quan',
    items: [
      { to: '/admin', end: true, label: 'Thống kê', icon: BarChart3 },
    ],
  },
  {
    title: 'Người dùng',
    items: [
      { to: '/admin/users', label: 'Tài khoản & phân quyền', icon: Users },
      { to: '/admin/partner-applications', label: 'Duyệt đối tác', icon: Handshake },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
      { to: '/admin/listings', label: 'Kiểm duyệt tin', icon: ClipboardCheck },
      { to: '/admin/reports', label: 'Báo cáo vi phạm', icon: Flag },
    ],
  },
  {
    title: 'Tài chính',
    items: [
      { to: '/admin/refunds', label: 'Hoàn tiền', icon: RotateCcw },
      { to: '/admin/commissions', label: 'Hoa hồng theo đơn', icon: Percent },
      { to: '/admin/fee-payments', label: 'Thu & đối soát phí', icon: Banknote },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/admin/audit-logs', label: 'Nhật ký thao tác', icon: FileClock },
      { to: '/admin/settings', label: 'Cấu hình quy tắc', icon: Settings },
    ],
  },
]

function Sidebar({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Điều hướng quản trị">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, end, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function AccessGate({ children }) {
  const { userId, me, loading, error } = useDevAccount()
  if (userId && loading) return <Loading text="Đang kiểm tra quyền truy cập..." />
  if (!me || !me.roles.includes('ADMIN')) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto text-emerald-600" size={32} />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Khu vực dành cho quản trị viên</h1>
        <p className="mt-1 text-sm text-slate-500">
          {me ? 'Bạn không có quyền truy cập chức năng này.' : 'Chọn một tài khoản có vai trò quản trị để tiếp tục.'} Trong
          dữ liệu mẫu, tài khoản <b>#2</b> là quản trị viên.
        </p>
        <div className="mt-4 flex justify-center">
          <DevAccountSwitcher />
        </div>
        <DevAccountError error={error} />
      </div>
    )
  }
  return children
}

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-green-100 text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-slate-200 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu quản trị"
          >
            <Menu size={18} />
          </button>
          <Link to="/" className="flex items-center gap-2" aria-label="Về trang chủ Chợ Đồ Cũ">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white">
              <Store size={17} />
            </span>
            <span className="hidden font-extrabold tracking-tight sm:inline">
              Chợ <span className="text-emerald-600">Đồ Cũ</span>
            </span>
          </Link>
          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase text-white">Quản trị</span>
        </div>
        <div className="hidden md:block">
          <DevAccountSwitcher compact />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <Sidebar />
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setMenuOpen(false)}>
            <aside className="h-full w-72 overflow-y-auto bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="font-semibold">Menu quản trị</span>
                <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Đóng menu">
                  <X size={18} />
                </button>
              </div>
              <div className="border-b border-slate-100 p-3 md:hidden">
                <DevAccountSwitcher compact />
              </div>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <AccessGate>
            <Outlet />
          </AccessGate>
        </main>
      </div>
    </div>
  )
}
