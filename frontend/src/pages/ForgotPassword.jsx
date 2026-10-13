import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'
import { Store } from 'lucide-react'
import './PasswordReset.scss'

const API_BASE_URL = '/api/auth'

function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      toast.error('Vui lòng nhập địa chỉ email.')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/forgot-password`, { email: normalizedEmail })
      sessionStorage.setItem('passwordResetEmail', normalizedEmail)
      sessionStorage.setItem('passwordResetResendAvailableAt', String(Date.now() + 61000))
      toast.success(response.data.message)
      navigate('/reset-password', { state: { email: normalizedEmail } })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrapper password-reset-page">
      <section className="auth-card" aria-labelledby="forgot-password-title">
        <Link to="/" className="password-reset-brand" aria-label="ChoDoCu - Trang chủ">
          <span className="password-reset-brand-icon">
            <Store size={27} strokeWidth={2.2} />
          </span>
          <span className="password-reset-brand-name">
            Chợ <strong>Đồ Cũ</strong>
          </span>
          <span className="password-reset-brand-tagline">Mua bán đồ cũ, dễ dàng hơn</span>
        </Link>

        <h2 id="forgot-password-title">Quên mật khẩu?</h2>
        <p className="otp-subtitle">
          Nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác thực để bạn đặt mật khẩu mới.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="forgot-password-email">Email</label>
            <input
              id="forgot-password-email"
              type="email"
              placeholder="abc@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={120}
              required
            />
          </div>

          <button type="submit" className="btn-main" disabled={loading}>
            {loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
          </button>
        </form>

        <div className="password-reset-footer">
          <Link to="/login">Quay lại đăng nhập</Link>
        </div>
      </section>
    </main>
  )
}

export default ForgotPassword
