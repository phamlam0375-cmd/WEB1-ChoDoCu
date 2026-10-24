import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'
import { Eye, EyeOff, Store } from 'lucide-react'
import './PasswordReset.scss'

const API_BASE_URL = '/api/auth'

function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email] = useState(
    location.state?.email || sessionStorage.getItem('passwordResetEmail') || ''
  )
  const developmentOtp = sessionStorage.getItem('passwordResetDelivery') === 'development-log'
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(() => {
    const availableAt = Number(sessionStorage.getItem('passwordResetResendAvailableAt'))
    return availableAt > Date.now() ? Math.ceil((availableAt - Date.now()) / 1000) : 0
  })

  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true })
  }, [email, navigate])

  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = setTimeout(() => setResendCountdown((remaining) => remaining - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCountdown])

  const handleResendCode = async () => {
    if (loading || resendCountdown > 0) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/forgot-password`, { email })
      toast.success(response.data.message)
      const availableAt = Date.now() + 61000
      sessionStorage.setItem('passwordResetResendAvailableAt', String(availableAt))
      setResendCountdown(Math.ceil((availableAt - Date.now()) / 1000))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể gửi lại mã. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (otp.length !== 6) {
      toast.error('Mã xác thực phải gồm đúng 6 chữ số.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      toast.error('Mật khẩu mới không được vượt quá 72 byte.')
      return
    }
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/reset-password`, {
        email,
        otp,
        newPassword
      })
      sessionStorage.removeItem('passwordResetEmail')
      sessionStorage.removeItem('passwordResetDelivery')
      sessionStorage.removeItem('passwordResetResendAvailableAt')
      toast.success(response.data.message)
      navigate('/login', { replace: true, state: { email } })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrapper password-reset-page">
      <section className="auth-card" aria-labelledby="reset-password-title">
        <Link to="/" className="password-reset-brand" aria-label="ChoDoCu - Trang chủ">
          <span className="password-reset-brand-icon">
            <Store size={27} strokeWidth={2.2} />
          </span>
          <span className="password-reset-brand-name">
            Chợ <strong>Đồ Cũ</strong>
          </span>
          <span className="password-reset-brand-tagline">Mua bán đồ cũ, dễ dàng hơn</span>
        </Link>

        <h2 id="reset-password-title">Đặt lại mật khẩu</h2>
        <p className="otp-subtitle">
          {developmentOtp
            ? <>Trong development, xem mã OTP trong log backend rồi nhập mã và tạo mật khẩu mới cho <strong>{email}</strong>.</>
            : <>Nhập mã xác thực đã gửi đến <strong>{email}</strong> và tạo mật khẩu mới.</>}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="reset-password-new">Mật khẩu mới</label>
            <div className="password-reset-input-wrapper">
              <input
                id="reset-password-new"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
              />
              <button
                type="button"
                className="password-reset-toggle"
                onClick={() => setShowNewPassword((visible) => !visible)}
                aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="reset-password-otp">Mã xác thực</label>
            <input
              id="reset-password-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Nhập mã 6 chữ số"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
            />
          </div>

          <button type="submit" className="btn-main" disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </form>

        <div className="password-reset-footer">
          <button
            type="button"
            className="password-reset-resend"
            onClick={handleResendCode}
            disabled={loading || resendCountdown > 0}
          >
            {resendCountdown > 0 ? `Gửi lại mã (${resendCountdown}s)` : 'Gửi lại mã xác thực'}
          </button>
        </div>
        <div className="password-reset-footer">
          <Link to="/login">Quay lại đăng nhập</Link>
        </div>
      </section>
    </main>
  )
}

export default ResetPassword
