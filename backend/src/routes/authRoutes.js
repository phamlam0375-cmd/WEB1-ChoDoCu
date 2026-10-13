// const express = require('express');
// const router = express.Router();
// const { register } = require('../controllers/authController');

// // Khai báo đường dẫn POST /api/auth/register
// router.post('/register', register);

// module.exports = router;
//code moi
const express = require('express');
const router = express.Router();

// Giả lập Đăng ký
router.post('/register', (req, res) => {
  const { email } = req.body;
  res.json({ message: `Mã OTP đã được gửi đến ${email}!` });
});

// Giả lập Xác thực OTP
router.post('/verify-email', (req, res) => {
  res.json({ message: 'Xác thực tài khoản thành công!' });
});

// Giả lập Đăng nhập
router.post('/login', (req, res) => {
  const { email } = req.body;
  res.json({
    message: 'Đăng nhập thành công!',
    token: 'mock-jwt-token-12345',
    user: { email }
  });
});

module.exports = router;