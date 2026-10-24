import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Register.scss';

const API_BASE_URL = '/api/auth';

const normalizeOtpValue = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Nhận email từ trang Đăng ký truyền sang
  const rawEmail = location.state?.email || sessionStorage.getItem('pendingVerificationEmail') || '';
  const email = rawEmail.toLowerCase().trim();
  const delivery = location.state?.delivery || sessionStorage.getItem('pendingVerificationDelivery');
  const developmentOtp = delivery === 'development-log';

  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const [countdown, setCountdown] = useState(60);
  const canResend = countdown === 0;

  // Đếm ngược gửi lại mã OTP
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Nhập từng ô OTP
  const handleOtpChange = (index, value) => {
    const sanitizedValue = normalizeOtpValue(value);
    const digit = sanitizedValue.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setOtpError('');

    if (digit && index < 5) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  // Xóa ô OTP bằng phím Backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        setOtpError('');
        return;
      }
      if (index > 0) {
        otpInputRefs[index - 1].current?.focus();
      }
    }
  };

  // Hỗ trợ Paste mã 6 số trực tiếp vào ô input
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = normalizeOtpValue(e.clipboardData.getData('text'));
    if (pastedData.length === 6) {
      const digits = pastedData.split('');
      setOtp(digits);
      setOtpError('');
      otpInputRefs[5].current?.focus();
    }
  };

  // Submit xác thực mã OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const fullOtp = normalizeOtpValue(otp.join(''));

    if (!email) {
      toast.error('Không tìm thấy thông tin Email! Vui lòng quay lại trang Đăng ký.');
      return;
    }

    if (fullOtp.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ mã OTP 6 chữ số!');
      return;
    }

    setLoading(true);
    setOtpError('');

    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: fullOtp }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.removeItem('pendingVerificationEmail');
        sessionStorage.removeItem('pendingVerificationDelivery');
        toast.success(data.message || 'Xác thực tài khoản thành công!');
        navigate('/login', {
          state: {
            email: String(email).trim().toLowerCase(),
            password: location.state?.password || ''
          }
        });
      } else {
        // Hiển thị chính xác thông báo lỗi từ Backend trả về
        setOtpError(data.message || 'Xác thực thất bại, vui lòng thử lại!');
      }
    } catch (err) {
      console.error('Lỗi khi gửi API Verify:', err);
      toast.error('Lỗi kết nối máy chủ! Kiểm tra lại Backend.');
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    if (!email) {
      toast.error('Không tìm thấy Email để gửi lại mã!');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      const response = await fetch(`${API_BASE_URL}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.delivery) {
          sessionStorage.setItem('pendingVerificationDelivery', data.delivery);
        }
        toast.success(data.message || 'Đã gửi lại mã xác thực vào email!');
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
        setOtpError('');
        otpInputRefs[0].current?.focus();
      } else {
        toast.error(data.message || 'Gửi lại mã thất bại!');
      }
    } catch (err) {
      console.error('Lỗi khi gửi lại OTP:', err);
      toast.error('Lỗi kết nối máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="mail-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <h3 className="verify-title">Kiểm tra hộp thư của bạn</h3>
        <p className="otp-subtitle">
          {developmentOtp
            ? <>Mã OTP chỉ được ghi trong log backend (development).<br />Xem log API để lấy mã.</>
            : <>Đã gửi mã xác thực 6 số đến<br /></>}
          <strong>{email || 'Chưa xác định Email'}</strong>
        </p>

        <form onSubmit={handleVerifyOtp}>
          <label className="otp-label">Nhập mã xác thực</label>
          <div className="otp-boxes">
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                ref={otpInputRefs[index]}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={index === 0 ? handleOtpPaste : undefined}
              />
            ))}
          </div>

          {otpError && <p className="error-text text-center">{otpError}</p>}

          <button type="submit" className="btn-main" disabled={loading}>
            {loading ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
        </form>

        <div className="otp-footer">
          <p className="resend-text">
            Chưa nhận được mã?{' '}
            <button
              type="button"
              className={`resend-link ${canResend && !loading ? 'active' : ''}`}
              onClick={handleResendOtp}
              disabled={!canResend || loading}
            >
              {loading ? 'Đang gửi mã...' : `Gửi lại mã${countdown > 0 ? ` (${countdown}s)` : ''}`}
            </button>
          </p>

          <span className="change-email" onClick={() => navigate('/register')} style={{ cursor: 'pointer' }}>
            Đổi email
          </span>

          <p className="spam-note">Không thấy email? Hãy kiểm tra mục Spam</p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;