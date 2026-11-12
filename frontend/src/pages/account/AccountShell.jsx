import { Outlet } from 'react-router-dom'
import Header from '../../components/Header'
import DevAccountSwitcher from '../../components/DevAccountSwitcher'
import DevAccountError from '../../components/DevAccountError'
import { Loading } from '../../components/admin/AdminUi'
import { useDevAccount } from '../../hooks/useDevAccount'
import AccountNavigation from './AccountNavigation'

// Khung cho các trang phân hệ B phía người dùng: báo cáo vi phạm, hoàn tiền, phí người bán.
export default function AccountShell({ hideNavigation = false }) {
  const { userId, me, loading, error } = useDevAccount()

  return (
    <div className="flex min-h-screen flex-col bg-green-100">
      <Header savedCount={0} onShowSaved={() => {}} onUnavailable={() => {}} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {!hideNavigation && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <AccountNavigation />
          <DevAccountSwitcher compact />
        </div>}
        {userId && loading ? (
          <Loading />
        ) : me ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-slate-900">Vui lòng đăng nhập</p>
            <p className="mt-1 text-sm text-slate-500">Đăng nhập bằng tài khoản của bạn để tiếp tục.</p>
            <div className="mt-4 flex justify-center">
              <DevAccountSwitcher />
            </div>
            <DevAccountError error={error} />
          </div>
        )}
      </div>
    </div>
  )
}
