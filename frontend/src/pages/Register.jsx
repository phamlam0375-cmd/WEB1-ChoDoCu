import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Store } from 'lucide-react';
import { registerForEmailVerification } from '../services/emailService';
import './Register.scss';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [fullNameError, setFullNameError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setFullNameError('');
    setPasswordError('');
    setConfirmPasswordError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!fullName.trim()) {
      setFullNameError('Vui lòng nhập họ và tên');
      isValid = false;
    }

    if (!email || !emailRegex.test(email)) {
      setEmailError('Email không hợp lệ hoặc đã được đăng ký');
      isValid = false;
    }

    if (!password || password.length < 8) {
      setPasswordError('Mật khẩu tối thiểu 8 ký tự');
      isValid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Mật khẩu nhập lại không khớp');
      isValid = false;
    }

    return isValid;
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const normalizedEmail = String(email).trim().toLowerCase();

    setLoading(true);
    try {
      const response = await registerForEmailVerification({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('pendingVerificationEmail', normalizedEmail);
        navigate('/verify-email', { state: { email: normalizedEmail, password } });
      } else {
        setEmailError(data.message || 'Email không hợp lệ hoặc đã được đăng ký');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <Link to="/" className="register-brand" aria-label="Chợ Đồ Cũ - Trang chủ">
          <span className="register-brand-icon">
            <Store size={27} strokeWidth={2.2} />
          </span>
          <span className="register-brand-name">
            Chợ <strong>Đồ Cũ</strong>
          </span>
          <span className="register-brand-tagline">Mua bán đồ cũ, dễ dàng hơn</span>
        </Link>
        <h2>Đăng ký tài khoản</h2>

        <form onSubmit={handleRegisterSubmit}>
          <div className="input-group">
            <label htmlFor="register-full-name">Họ và tên</label>
            <input
              id="register-full-name"
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFullNameError('');
              }}
              autoComplete="name"
              maxLength={100}
            />
            {fullNameError && <p className="error-text">{fullNameError}</p>}
          </div>

          {/* Email */}
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="abc@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
            />
            {emailError && <p className="error-text">{emailError}</p>}
          </div>

          {/* Mật khẩu */}
          <div className="input-group">
            <label>Mật khẩu</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
              />
              <button
                type="button"
                className="toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            {passwordError && <p className="error-text">{passwordError}</p>}
          </div>

          {/* Nhập lại mật khẩu */}
          <div className="input-group">
            <label>Nhập lại mật khẩu</label>
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError('');
                }}
              />
              <button
                type="button"
                className="toggle-eye"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
            {confirmPasswordError && <p className="error-text">{confirmPasswordError}</p>}
          </div>

          {/* Nút Đăng ký */}
          <button type="submit" className="btn-main" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>

          <div className="login-link">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </div>
          <div className="login-link">
            <Link to="/privacy">Chính sách quyền riêng tư</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;