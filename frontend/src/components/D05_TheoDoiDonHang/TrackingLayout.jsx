import { Outlet } from 'react-router-dom'
import Header from '../Header'
import Footer from '../Footer'
import DevAccountSwitcher from '../DevAccountSwitcher'
import AccountNavigation from '../../pages/account/AccountNavigation'
// Không gọi /me để giả cấp phiên cho buyer demo; API tracking kiểm tra quyền.
export default function TrackingLayout() {
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    <main className="mx-auto min-h-[600px] max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <AccountNavigation />
        <DevAccountSwitcher compact />
      </div>
      <Outlet />
    </main>
    <Footer />
  </div>
}
