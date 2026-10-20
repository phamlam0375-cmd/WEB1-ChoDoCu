import 'react-toastify/dist/ReactToastify.css'
import './App.scss'

import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import CreateListing from './pages/listing/CreateListing'
import CrudListing from './pages/listing/CrudListing'
import DevAccountProvider from './context/DevAccountProvider'
import ForgotPassword from './pages/ForgotPassword'
import HomePage from './pages/HomePage'
import { Loading } from './components/admin/AdminUi'
import Login from './pages/Login'
import OrderCancelPage from './pages/D02_HuyDonHang/OrderCancelPage'
import OrderCreatePage from './pages/OrderCreatePage'
import OrderPaymentPage from './pages/D03_ThanhToan/OrderPaymentPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import PublicStore from './pages/Store/PublicStore'
import Register from './pages/Register'
import RegisterApplication from './components/PartnerApplication/RegisterApplication'
import ResetPassword from './pages/ResetPassword'
import SellerStore from './pages/Store/SellerStore'
import { ToastContainer } from 'react-toastify'
import VerifyEmail from './pages/VerifyEmail'

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
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'))
const AccountShell = lazy(() => import('./pages/account/AccountShell'))
const ReportCreatePage = lazy(() => import('./pages/account/ReportCreatePage'))
const MyReportsPage = lazy(() => import('./pages/account/MyReportsPage'))
const RefundCreatePage = lazy(() => import('./pages/account/RefundCreatePage'))
const MyRefundsPage = lazy(() => import('./pages/account/MyRefundsPage'))
const SellerFeesPage = lazy(() => import('./pages/account/SellerFeesPage'))
const MomoPaymentPage = lazy(() => import('./pages/account/MomoPaymentPage'))
const SellerPaymentsPage = lazy(() => import('./pages/D04_XacNhanNhanTien/SellerPaymentsPage'))
const SellerPaymentPage = lazy(() => import('./pages/D04_XacNhanNhanTien/SellerPaymentPage'))
const TrackingLayout = lazy(() => import('./components/D05_TheoDoiDonHang/TrackingLayout'))
const BuyerOrdersPage = lazy(() => import('./pages/D05_TheoDoiDonHang/BuyerOrdersPage'))
const OrderTrackingPage = lazy(() => import('./pages/D05_TheoDoiDonHang/OrderTrackingPage'))


function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/verify-email" element={<VerifyEmail />} /> {/* <-- Route cho trang nhập OTP */}
        <Route path="/orders/create/:listingId" element={<OrderCreatePage />} />
        <Route path="/orders/:orderId/cancel" element={<OrderCancelPage />} />
        <Route path="/orders/:orderId/payment" element={<OrderPaymentPage />} />

        <Route path="/partner-application" element={<RegisterApplication />} />
        <Route path="store/:ownerId" element={<PublicStore />} />
        <Route path="/seller/store" element={<SellerStore />} />
        <Route path="seller/listings" element={<CrudListing />} />
        <Route path="seller/listings/create" element={<CreateListing />} />

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
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
          <Route element={<TrackingLayout />}>
            <Route path="/orders" element={<BuyerOrdersPage />} />
            <Route path="/orders/:orderId/tracking" element={<OrderTrackingPage />} />
          </Route>
          <Route element={<AccountShell />}>
            <Route path="/seller/payments" element={<SellerPaymentsPage />} />
            <Route path="/seller/orders/:orderId/payment" element={<SellerPaymentPage />} />
            <Route path="/reports" element={<MyReportsPage />} />
            <Route path="/reports/new" element={<ReportCreatePage />} />
            <Route path="/orders/:orderId/refund" element={<RefundCreatePage />} />
            <Route path="/refunds" element={<MyRefundsPage />} />
            <Route path="/seller/fees" element={<SellerFeesPage />} />
            <Route path="/payment" element={<MomoPaymentPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
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