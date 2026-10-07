import { useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, setDevUserId } from '../lib/api'
import { completeLogin } from '../lib/auth'
import { loginWithPassword } from '../services/authApi'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const submitLock = useRef(false)
  const [loginError, setLoginError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    if (submitLock.current) return

    if (!email || !password) {
      alert('Vui lòng nhập đầy đủ Gmail và mật khẩu!')
      return
    }

    submitLock.current = true
    setLoginError('')
    setLoading(true)
    try {
      const session = await loginWithPassword(email.trim(), password)
      completeLogin(session, {
        storage: window.localStorage,
        redirectStorage: window.sessionStorage,
        queryReturnTo: searchParams.get('returnTo'),
        stateFrom: location.state?.from,
        clearDevIdentity: () => setDevUserId(''),
        navigate,
      })
      alert(session.message)
    } catch (error) {
      setLoginError(errorMessage(error, error.message || 'Gmail hoặc mật khẩu không chính xác!'))
    } finally {
      submitLock.current = false
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

        <form onSubmit={handleLogin} aria-busy={loading}>
          {loginError && <p role="alert" className="mb-4 text-sm text-red-600">{loginError}</p>}
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
