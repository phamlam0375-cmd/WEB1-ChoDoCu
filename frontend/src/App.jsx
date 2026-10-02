import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'

import HomePage from './pages/HomePage'
import Login from './pages/Login'
import RegisterApplication from './components/PartnerApplication/RegisterApplication'

// Phân hệ B: quản trị và doanh thu (tải khi cần để không làm nặng trang chủ)
import DevAccountProvider from './context/DevAccountProvider'
import { Loading } from './components/admin/AdminUi'
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminPartnerApplicationsPage = lazy(() => import('./pages/admin/AdminPartnerApplicationsPage'))
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'))

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />

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
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="partner-applications" element={<AdminPartnerApplicationsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={2800}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />
    </>
  )
}

export default App