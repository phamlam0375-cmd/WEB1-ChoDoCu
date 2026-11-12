import { useEffect, useState } from 'react'
import {
  Heart,
  LogOut,
  Menu,
  ClipboardList,
  Truck,
  Bell,
  Store,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ColorThemePicker from './ColorThemePicker'
import { clearSession, getAccessToken } from '../lib/auth'
import { api } from '../lib/api'
import creditApi from '../services/apiClient'

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
  { label: 'Trang chủ', to: '/#top' },
  { label: 'Sản phẩm', to: '/#san-pham' },
  { label: 'Danh mục', to: '/#danh-muc' },
  { label: 'Hỗ trợ', to: '/#ho-tro' },
]

const utilityButtonClass = 'inline-flex  whitespace-nowrap h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'

function Header({
  savedCount = 0,
  savedOnly = false,
  onShowSaved = () => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [user, setUser] = useState(readStoredUser)
  const [creditBalance, setCreditBalance] = useState(0)
  const [creditLoading, setCreditLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = user?.roles?.includes('ADMIN') || user?.Roles?.includes('ADMIN')
  const isSeller = user?.roles?.includes('SELLER') || user?.Roles?.includes('SELLER')

  useEffect(() => {
    if (!location.hash) return undefined

    const targetId = decodeURIComponent(location.hash.slice(1))
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])

  useEffect(() => {
    const syncUser = (event) => setUser(event.detail || readStoredUser())
    window.addEventListener('profile-updated', syncUser)
    const syncSession = async () => {
      if (!getAccessToken({ sessionOnly: true })) {
        setUser(readStoredUser())
        setCreditBalance(0)
        return
      }
      try {
        const response = await api.get('/me', { sessionOnly: true })
        const freshUser = response.data?.data
        if (freshUser) {
          setUser(current => ({ ...current, ...freshUser }))
          window.localStorage.setItem('user', JSON.stringify({ ...readStoredUser(), ...freshUser }))
        }
      } catch {
        setUser(readStoredUser())
      }
    }
    window.addEventListener('auth-session-changed', syncSession)
    syncSession()
    return () => {
      window.removeEventListener('profile-updated', syncUser)
      window.removeEventListener('auth-session-changed', syncSession)
    }
  }, [])

  useEffect(() => {
    let active = true
    const refreshBalance = () => {
      if (!user || !getAccessToken({ sessionOnly: true })) {
        setCreditBalance(0)
        return
      }
      setCreditLoading(true)
      creditApi.get('/credit/balance', { sessionOnly: true })
        .then((response) => {
          if (active) setCreditBalance(response.data?.data?.balance ?? 0)
        })
        .catch(() => {
          if (active) setCreditBalance(0)
        })
        .finally(() => {
          if (active) setCreditLoading(false)
        })
    }

    refreshBalance()
    window.addEventListener('credit-balance-updated', refreshBalance)

    return () => {
      active = false
      window.removeEventListener('credit-balance-updated', refreshBalance)
    }
  }, [user])

  useEffect(() => {
    let active = true
    const refreshNotifications = async () => {
      if (!user) {
        setNotifications([])
        setUnreadNotifications(0)
        return
      }
      setNotificationsLoading(true)
      try {
        const response = await api.get('/notifications?limit=20')
        if (active) {
          setNotifications(response.data?.data?.notifications || [])
          setUnreadNotifications(Number(response.data?.data?.unreadCount || 0))
        }
      } catch {
        console.error('Không thể tải thông báo.')
        if (active) setNotifications([])
      } finally {
        if (active) setNotificationsLoading(false)
      }
    }

    refreshNotifications()
    const timer = window.setInterval(refreshNotifications, 30000)
    window.addEventListener('notifications-updated', refreshNotifications)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('notifications-updated', refreshNotifications)
    }
  }, [user])

  const markNotificationRead = async (notification) => {
    if (notification.IsRead) return
    try {
      await api.patch(`/notifications/${notification.NotificationId}/read`, {})
      setNotifications((current) => current.map((item) => item.NotificationId === notification.NotificationId
        ? { ...item, IsRead: true }
        : item))
      setUnreadNotifications((count) => Math.max(0, count - 1))
    } catch {
      console.error('Không thể đánh dấu thông báo đã đọc.')
    }
  }

  const markAllNotificationsRead = async () => {
    if (!unreadNotifications) return
    try {
      await api.patch('/notifications/read-all', {})
      setNotifications((current) => current.map((item) => ({ ...item, IsRead: true })))
      setUnreadNotifications(0)
    } catch {
      console.error('Không thể đánh dấu toàn bộ thông báo đã đọc.')
    }
  }

  const getNotificationUrl = (notification) => {
    const referenceId = Number(notification.ReferenceId)
    if (!Number.isSafeInteger(referenceId) || referenceId <= 0) return null

    switch (String(notification.ReferenceType || '').toUpperCase()) {
      case 'ORDER':
        return isSeller
          ? '/seller/orders'
          : `/orders/${referenceId}/tracking`
      case 'PAYMENT':
        return `/orders/${referenceId}/payment`
      case 'REFUND_REQUEST':
        return '/refunds'
      case 'COMMISSION':
        return '/seller/fees'
      case 'PARTNER_APPLICATION':
        return '/partner-application'
      case 'LISTING':
        return '/seller/listings'
      default:
        return null
    }
  }

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification)
    const url = getNotificationUrl(notification)
    if (url) {
      setNotificationsOpen(false)
      navigate(url)
    }
  }

  const closeMenu = () => {
    setMenuOpen(false)
    setAccountMenuOpen(false)
  }

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
      {(user?.AvatarUrl || user?.avatarUrl) && (
        <img
          src={user.AvatarUrl || user.avatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
    </span>
  )

  const renderAccountMenu = (positionClass) => (
    accountMenuOpen && (
      <div
        role="menu"
        className={`absolute ${positionClass} z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg`}
      >
        <Link
          to="/profile"
          onClick={closeMenu}
          role="menuitem"
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
        >
          <UserRound size={17} />
          Hồ sơ cá nhân
        </Link>
        {isSeller && (
          <Link
            to="/seller/store"
            onClick={closeMenu}
            role="menuitem"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Store size={17} />
            Cửa hàng của tôi
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={closeMenu}
            role="menuitem"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            <ShieldCheck size={17} />
            Trang quản trị
          </Link>
        )}
        <div className="mt-1 flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm text-slate-600">
          <Wallet size={17} className="text-emerald-600" />
          <span>Credit:</span>
          <strong className="ml-auto text-emerald-700">
            {creditLoading ? '...' : Number(creditBalance || 0).toLocaleString('vi-VN')}
          </strong>
        </div>
        <Link
          to="/credit/packages"
          onClick={closeMenu}
          role="menuitem"
          className="flex items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Nạp thêm
        </Link>
      </div>
    )
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
            <Link
              key={item.label}
              to={item.to}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {item.label}
            </Link>
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className={`${utilityButtonClass} relative size-10 shrink-0 p-0`}
              aria-label={`Thông báo${unreadNotifications ? `, ${unreadNotifications} chưa đọc` : ''}`}
              title="Thông báo"
            >
              <Bell size={19} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <strong className="text-sm text-slate-800">Thông báo</strong>
                  <button type="button" onClick={markAllNotificationsRead} className="text-xs font-semibold text-emerald-700 hover:underline">
                    Đánh dấu đã đọc
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">Đang tải...</p>
                  ) : notifications.length ? notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.NotificationId}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-emerald-50 ${notification.IsRead ? 'bg-white' : 'bg-emerald-50/60'}`}
                    >
                      <p className="text-sm font-semibold text-slate-800">{notification.Title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{notification.Message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{new Date(notification.CreatedAt).toLocaleString('vi-VN')}</p>
                    </button>
                  )) : (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  aria-label="Mở menu tài khoản"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                {renderUserAvatar()}
                </button>
                {renderAccountMenu('right-0 top-full mt-2')}
              </div>
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
              <Link
                key={item.label}
                to={item.to}
                onClick={closeMenu}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                {item.label}
              </Link>
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

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(true)
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              <Bell size={17} />
              Thông báo
              {unreadNotifications > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-5 text-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            {user ? (
              <>
                <div className="col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-1">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen((open) => !open)}
                      aria-label="Mở menu tài khoản"
                      aria-expanded={accountMenuOpen}
                      aria-haspopup="menu"
                      className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                    {renderUserAvatar('size-11')}
                    </button>
                    {renderAccountMenu('left-0 top-full mt-2')}
                  </div>
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
