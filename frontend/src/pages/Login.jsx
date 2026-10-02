import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (event) => {
    event.preventDefault()

    if (!email || !password) {
      alert('Vui lòng nhập đầy đủ Gmail và mật khẩu!')
      return
    }

    if (email === 'admin@gmail.com' && password === '123456') {
      alert('Đăng nhập thành công!')
      navigate('/')
      return
    }

    alert('Gmail hoặc mật khẩu không đúng!')
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
        {/* Icon */}
        <div className="login-icon">
          👋
        </div>

        {/* Tiêu đề */}
        <h1>Chào mừng trở lại!</h1>

        <p className="login-description">
          Đăng nhập để tiếp tục sử dụng ChoĐồCũ
        </p>

        <form onSubmit={handleLogin}>
          {/* Gmail */}
          <div className="login-input-group">
            <label htmlFor="login-email">
              Gmail
            </label>

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

          {/* Mật khẩu */}
          <div className="login-input-group">
            <label htmlFor="login-password">
              Mật khẩu
            </label>

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

          {/* Ghi nhớ + Quên mật khẩu */}
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

          {/* Đăng nhập */}
          <button
            type="submit"
            className="login-submit"
          >
            Đăng nhập
          </button>
        </form>

        {/* Đăng ký */}
        <p className="login-register">
          Chưa có tài khoản?

          <button
            type="button"
            onClick={handleRegister}
          >
            Đăng ký ngay
          </button>
        </p>
      </div>
    </main>
  )
}

export default Login