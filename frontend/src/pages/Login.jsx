import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, setDevUserId } from '../lib/api'
import { completeLogin } from '../lib/auth'
import { loginWithGoogle, loginWithPassword } from '../services/authApi'
import './Login.scss'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const submitLock = useRef(false)
  const [loginError, setLoginError] = useState('')

  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState(location.state?.password || '')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const googleButtonRef = useRef(null)

  const handleGoogleLogin = useCallback(async (credential) => {
    try {
      setLoading(true)
      setGoogleError('')
      const session = await loginWithGoogle(credential)
      completeLogin(session, {
        storage: window.localStorage,
        redirectStorage: window.sessionStorage,
        queryReturnTo: searchParams.get('returnTo'),
        stateFrom: location.state?.from,
        clearDevIdentity: () => setDevUserId(''),
        navigate,
      })
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error)
      setGoogleError(errorMessage(error, error.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.'))
    } finally {
      setLoading(false)
    }
  }, [location.state, navigate, searchParams])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined

    let active = true
    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => handleGoogleLogin(credential),
        context: 'signin',
        ux_mode: 'popup'
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(350, googleButtonRef.current.clientWidth)
      })
    }

    let script = document.getElementById('google-identity-services')
    if (!script) {
      script = document.createElement('script')
      script.id = 'google-identity-services'
      script.src = 'https://accounts.google.com/gsi/client?hl=vi'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton()
    } else {
      script.addEventListener('load', renderGoogleButton)
    }

    return () => {
      active = false
      script?.removeEventListener('load', renderGoogleButton)
    }
  }, [handleGoogleLogin])

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
          Đăng nhập để tiếp tục sử dụng Chợ Đồ Cũ
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
            <div className="login-password-wrapper">
              <input
                id="login-password"
                className="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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

        <div className="login-divider"><span>hoặc</span></div>
        {GOOGLE_CLIENT_ID ? (
          <div className="google-login-button" ref={googleButtonRef} />
        ) : (
          <button
            type="button"
            className="google-login-unconfigured"
            onClick={() => setGoogleError('Đăng nhập Google chưa được cấu hình Client ID.')}
          >
            <span className="google-g" aria-hidden="true">G</span>
            Đăng nhập bằng Google
          </button>
        )}
        {googleError && <p className="google-login-error" role="alert">{googleError}</p>}

        <p className="login-register">
          Chưa có tài khoản?{' '}
          <button type="button" onClick={handleRegister}>
            Đăng ký ngay
          </button>
        </p>
        <p className="login-register">
          <Link to="/privacy">Chính sách quyền riêng tư</Link>
        </p>
      </div>
    </main>
  )
}

export default Login
