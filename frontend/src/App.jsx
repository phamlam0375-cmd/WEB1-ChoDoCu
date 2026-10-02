import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'

import HomePage from './pages/HomePage'
import Login from './pages/Login'
import OrderCreatePage from './pages/OrderCreatePage'
import RegisterApplication from './components/PartnerApplication/RegisterApplication'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/orders/create/:listingId" element={<OrderCreatePage />} />

        <Route path="/partner-application" element={<RegisterApplication />} />
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
