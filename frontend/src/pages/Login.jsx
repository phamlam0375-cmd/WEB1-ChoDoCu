import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorMessage, setDevUserId } from '../lib/api'
import { completeLogin } from '../lib/auth'
import { loginWithGoogle, loginWithPassword } from '../services/authApi'
import './Login.scss'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_MOCK_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_GOOGLE_MOCK === 'true'

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

  const handleDevGoogle = useCallback(async () => {
    try {
      setLoading(true)
      setGoogleError('')
      const defaultEmail = email.endsWith('@example.test')
        ? email
        : `dev+${Math.floor(Math.random() * 10000)}@example.test`
      const input = window.prompt('Nhập email thử nghiệm (phải kết thúc bằng @example.test):', defaultEmail)
      if (!input) return
      const chosen = String(input).trim().toLowerCase()

      const baseURL = api.defaults.baseURL.replace(/\/v1\/?$/, '')
      const { data } = await api.post('/auth/google/dev', { email: chosen }, { baseURL, skipSession: true })
      const accessToken = data?.accessToken || data?.token
      if (typeof accessToken !== 'string' || !accessToken.trim()) throw new Error('Không nhận được token từ server')

      const me = await api.get('/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        skipSession: true,
      })

      const session = {
        accessToken,
        user: { ...data.user, ...me.data.data },
        message: data.message || 'Đăng nhập Google thử nghiệm thành công!'
      }

      completeLogin(session, {
        storage: window.localStorage,
        redirectStorage: window.sessionStorage,
        queryReturnTo: searchParams.get('returnTo'),
        stateFrom: location.state?.from,
        clearDevIdentity: () => setDevUserId(''),
        navigate,
      })
    } catch (error) {
      console.error('Lỗi đăng nhập Google (dev):', error)
      setGoogleError(errorMessage(error, error.message || 'Không thể đăng nhập bằng Google thử nghiệm.'))
    } finally {
      setLoading(false)
    }
  }, [email, navigate, location.state, searchParams])

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

        {GOOGLE_CLIENT_ID ? (
          <>
            <div className="login-divider"><span>hoặc</span></div>
            <div className="google-login-button" ref={googleButtonRef} />
          </>
        ) : (GOOGLE_MOCK_ENABLED ? (
          <>
            <div className="login-divider"><span>hoặc</span></div>
            <div className="google-mock-login">
              <button
                type="button"
                className="google-login-unconfigured"
                onClick={handleDevGoogle}
                disabled={loading}
              >
                {loading ? 'Đang xử lý...' : 'Đăng nhập Google thử nghiệm'}
              </button>
              <p className="google-login-hint">Chỉ dành cho development. Dùng email giả kết thúc bằng @example.test; không cần cấu hình Google Client ID.</p>
            </div>
          </>
        ) : (
          <p className="google-login-error">
            Đăng nhập Google chưa được bật; hãy dùng email và mật khẩu.
          </p>
        ))}
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
