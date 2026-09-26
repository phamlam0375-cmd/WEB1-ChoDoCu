import { useState } from 'react'
import {
  Heart,
  Menu,
  PlusCircle,
  Store,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const navItems = [
  { label: 'Trang chủ', href: '#top' },
  { label: 'Sản phẩm', href: '#san-pham' },
  { label: 'Danh mục', href: '#danh-muc' },
  { label: 'Hỗ trợ', href: '#ho-tro' },
]

function Header({ savedCount, savedOnly, onShowSaved, onUnavailable }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navigate = useNavigate()

  const closeMenu = () => setMenuOpen(false)

  const handleLogin = () => {
    closeMenu()
    navigate('/login')
  }

  const handleRegister = () => {
    closeMenu()
    navigate('/register')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

        {/* LOGO */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Chợ Đồ Cũ - Trang chủ"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Store size={22} strokeWidth={2.2} />
          </span>

          <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Chợ <span className="text-emerald-600">Đồ Cũ</span>
          </span>
        </Link>

        {/* DESKTOP MENU */}
        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Điều hướng chính"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              {item.label}
            </a>
          ))}

          <button
            type="button"
            onClick={onShowSaved}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              savedOnly
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            Tin đã lưu
          </button>
        </nav>

        {/* DESKTOP ACTIONS */}
        <div className="hidden items-center gap-2 lg:flex">

          {/* Tin đã lưu */}
          <button
            type="button"
            onClick={onShowSaved}
            className="relative grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label={`Xem ${savedCount} tin đã lưu`}
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <PlusCircle size={17} />
            Đăng tin
          </button>

          {/* Đăng nhập */}
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <UserRound size={17} />
            Đăng nhập
          </button>

          {/* Đăng ký */}
          <button
            type="button"
            onClick={handleRegister}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-600 px-3.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            <UserPlus size={17} />
            Đăng ký
          </button>
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
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
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50"
              >
                {item.label}
              </a>
            ))}

            {/* Tin đã lưu */}
            <button
              type="button"
              onClick={() => {
                onShowSaved()
                closeMenu()
              }}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50"
            >
              Tin đã lưu

              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                {savedCount}
              </span>
            </button>
          </nav>

          {/* MOBILE ACTIONS */}
          <div className="mx-auto mt-3 grid max-w-7xl grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">

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

            {/* Đăng nhập */}
            <button
              type="button"
              onClick={handleLogin}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              Đăng nhập
            </button>

            {/* Đăng ký */}
            <button
              type="button"
              onClick={handleRegister}
              className="col-span-2 rounded-xl border border-emerald-600 px-3 py-2.5 text-sm font-semibold text-emerald-700 sm:col-span-1"
            >
              Đăng ký
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header