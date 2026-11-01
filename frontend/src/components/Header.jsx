import { useEffect, useState } from 'react'
import {
  Heart,
  LogOut,
  Menu,
  ClipboardList,
  Truck,
  PlusCircle,
  Store,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ColorThemePicker from './ColorThemePicker'
import { clearSession } from '../lib/auth'

const readStoredUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    return user && typeof user === 'object' ? user : null
  } catch {
    return null
  }
}

const getUserInitials = (fullName = '') => fullName
  .trim()
  .split(/\s+/)
  .slice(-2)
  .map((part) => part[0])
  .join('')
  .toLocaleUpperCase('vi-VN') || 'U'

const navItems = [
  { label: 'Trang chủ', href: '#top' },
  { label: 'Sản phẩm', href: '#san-pham' },
  { label: 'Danh mục', href: '#danh-muc' },
  { label: 'Hỗ trợ', href: '#ho-tro' },
]

const utilityButtonClass = 'inline-flex  whitespace-nowrap h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'

function Header({
  savedCount = 0,
  savedOnly = false,
  onShowSaved = () => {},
  onUnavailable = () => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(readStoredUser)

  const navigate = useNavigate()

  useEffect(() => {
    const syncUser = (event) => setUser(event.detail || readStoredUser())
    window.addEventListener('profile-updated', syncUser)
    return () => window.removeEventListener('profile-updated', syncUser)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  const handleLogin = () => {
    closeMenu()
    navigate('/login')
  }

  const handleRegister = () => {
    closeMenu()
    navigate('/register')
  }

  const handleLogout = () => {
    clearSession()
    setUser(null)
    closeMenu()
    navigate('/')
  }

  const renderUserAvatar = (className = 'size-10') => (
    <span className={`relative grid ${className} shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-800`}>
      {getUserInitials(user?.FullName)}
      {user?.AvatarUrl && (
        <img
          src={user.AvatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
    </span>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_3px_rgb(15_23_42/6%)] backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

        {/* LOGO */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          aria-label="Chợ Đồ Cũ - Trang chủ"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <Store size={22} strokeWidth={2.2} />
          </span>

          <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Chợ <span className="text-emerald-600">Đồ Cũ</span>
          </span>
        </Link>

        {/* DESKTOP MENU */}
        <nav
          className="hidden shrink-0 items-center gap-0.5 xl:flex"
          aria-label="Điều hướng chính"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* DESKTOP ACTIONS */}
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          <ColorThemePicker />
          {user && <Link to="/driver/deliveries" className={utilityButtonClass} title="Chuyến tài xế">
            <Truck size={17} /><span className="hidden 2xl:inline">Chuyến tài xế</span>
          </Link>}

          <Link
            to="/orders"
            className={utilityButtonClass}
            aria-label="Đơn mua của tôi"
            title="Đơn mua của tôi"
          >
            <ClipboardList size={17} />
            <span className="hidden 2xl:inline">Đơn mua</span>
          </Link>
          <button
            type="button"
            onClick={onShowSaved}
            className={`${utilityButtonClass} relative size-10 shrink-0 p-0 ${savedOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : ''}`}
            aria-label={`Xem ${savedCount} tin đã lưu`}
            title="Tin đã lưu"
          >
            <Heart
              size={19}
              className={
                savedCount
                  ? 'fill-emerald-600 text-emerald-600'
                  : ''
              }
            />

            {savedCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
                {savedCount}
              </span>
            )}
          </button>

          {/* Đăng tin */}
          <button
            type="button"
            onClick={() => onUnavailable('Đăng tin')}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <PlusCircle size={17} />
            Đăng tin
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/profile" aria-label="Mở hồ sơ cá nhân">
                {renderUserAvatar()}
              </Link>
              <Link to="/profile" className="max-w-40 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Mở hồ sơ cá nhân">
                <p className="truncate text-sm font-semibold text-slate-800">{user.FullName}</p>
                <p className="truncate text-xs text-slate-500">{user.Email}</p>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={`${utilityButtonClass} size-10 shrink-0 p-0 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLogin}
                className={utilityButtonClass}
              >
                <UserRound size={17} />
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={handleRegister}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <UserPlus size={17} />
                Đăng ký
              </button>
            </>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 lg:hidden"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-lg lg:hidden">

          <nav
            className="mx-auto grid max-w-7xl gap-1"
            aria-label="Điều hướng di động"
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                {item.label}
              </a>
            ))}

            {/* Tin đã lưu */}
            {user && <Link to="/driver/deliveries" onClick={closeMenu} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700">
              <Truck size={17} />Chuyến tài xế
            </Link>}
            <Link to="/orders" onClick={closeMenu} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800">
              <ClipboardList size={17} />
              Đơn mua của tôi
            </Link>
            <button
              type="button"
              onClick={() => {
                onShowSaved()
                closeMenu()
              }}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-emerald-50 hover:text-emerald-800 ${savedOnly ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'}`}
            >
              Tin đã lưu

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                {savedCount}
              </span>
            </button>
          </nav>

          {/* MOBILE ACTIONS */}
          <div className="mx-auto mt-3 grid max-w-7xl grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <ColorThemePicker />
            </div>

            {/* Đăng tin */}
            <button
              type="button"
              onClick={() => {
                onUnavailable('Đăng tin')
                closeMenu()
              }}
              className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"
            >
              Đăng tin
            </button>

            {user ? (
              <>
                <div className="col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-1">
                  <Link to="/profile" onClick={closeMenu} aria-label="Mở hồ sơ cá nhân">
                    {renderUserAvatar('size-11')}
                  </Link>
                  <Link to="/profile" onClick={closeMenu} className="min-w-0" aria-label="Mở hồ sơ cá nhân">
                    <p className="truncate text-sm font-semibold text-slate-800">{user.FullName}</p>
                    <p className="truncate text-xs text-slate-500">{user.Email}</p>
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:col-span-1"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={handleRegister}
                  className="col-span-2 rounded-xl border border-emerald-600/20 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 sm:col-span-1"
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
