import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!email || !password) {
      alert('Vui lòng nhập đầy đủ Gmail và mật khẩu!')
      return
    }

    try {
      setLoading(true)
      // Gọi API đăng nhập xuống Backend
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      })

      alert(response.data.message || 'Đăng nhập thành công!')

      // Lưu thông tin người dùng / token nếu có
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user))
      }

      navigate('/')
    } catch (error) {
      console.error('Lỗi đăng nhập:', error)
      alert(error.response?.data?.message || 'Gmail hoặc mật khẩu không chính xác!')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    navigate('/forgot-password')
  }

  const handleRegister = () => {
    navigate('/register')
  }

  return (
    <main className="login-page">
      <div className="login-box">
        <div className="login-icon">👋</div>

        <h1>Chào mừng trở lại!</h1>
        <p className="login-description">
          Đăng nhập để tiếp tục sử dụng ChoĐồCũ
        </p>

        <form onSubmit={handleLogin}>
          <div className="login-input-group">
            <label htmlFor="login-email">Gmail</label>
            <input
              id="login-email"
              className="login-email"
              type="email"
              placeholder="Nhập Gmail của bạn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="login-input-group">
            <label htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              className="login-password"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="login-options">
            <label>
              <input type="checkbox" />
              Ghi nhớ đăng nhập
            </label>

            <button
              type="button"
              className="forgot-password"
              onClick={handleForgotPassword}
            >
              Quên mật khẩu?
            </button>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-register">
          Chưa có tài khoản?{' '}
          <button type="button" onClick={handleRegister}>
            Đăng ký ngay
          </button>
        </p>
      </div>
    </main>
  )
}

export default Login