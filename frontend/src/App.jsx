import 'react-toastify/dist/ReactToastify.css'
import './App.css'

import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import DevAccountProvider from './context/DevAccountProvider'
import HomePage from './pages/HomePage'
import { Loading } from './components/admin/AdminUi'
import Login from './pages/Login'
import OrderCreatePage from './pages/OrderCreatePage'
import RegisterApplication from './components/PartnerApplication/RegisterApplication'
import { ToastContainer } from 'react-toastify'

// Phân hệ B: quản trị và doanh thu (tải khi cần để không làm nặng trang chủ)


const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminPartnerApplicationsPage = lazy(() => import('./pages/admin/AdminPartnerApplicationsPage'))
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'))
const AdminListingsPage = lazy(() => import('./pages/admin/AdminListingsPage'))
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'))
const AdminRefundsPage = lazy(() => import('./pages/admin/AdminRefundsPage'))
const AdminCommissionsPage = lazy(() => import('./pages/admin/AdminCommissionsPage'))
const AdminFeePaymentsPage = lazy(() => import('./pages/admin/AdminFeePaymentsPage'))
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'))
const AccountShell = lazy(() => import('./pages/account/AccountShell'))
const ReportCreatePage = lazy(() => import('./pages/account/ReportCreatePage'))
const MyReportsPage = lazy(() => import('./pages/account/MyReportsPage'))
const RefundCreatePage = lazy(() => import('./pages/account/RefundCreatePage'))
const MyRefundsPage = lazy(() => import('./pages/account/MyRefundsPage'))
const SellerFeesPage = lazy(() => import('./pages/account/SellerFeesPage'))

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/orders/create/:listingId" element={<OrderCreatePage />} />

        <Route path="/partner-application" element={<RegisterApplication />} />

        <Route
          element={
            <DevAccountProvider>
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </DevAccountProvider>
          }
        >
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="partner-applications" element={<AdminPartnerApplicationsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="listings" element={<AdminListingsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="refunds" element={<AdminRefundsPage />} />
            <Route path="commissions" element={<AdminCommissionsPage />} />
            <Route path="fee-payments" element={<AdminFeePaymentsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
          <Route element={<AccountShell />}>
            <Route path="/reports" element={<MyReportsPage />} />
            <Route path="/reports/new" element={<ReportCreatePage />} />
            <Route path="/orders/:orderId/refund" element={<RefundCreatePage />} />
            <Route path="/refunds" element={<MyRefundsPage />} />
            <Route path="/seller/fees" element={<SellerFeesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={10000}
        closeOnClick={false}
        pauseOnHover
        pauseOnFocusLoss={false}
        newestOnTop
        theme="light"
      />
    </>
  )
}

export default App
