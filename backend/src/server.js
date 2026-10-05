const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Cấu hình CORS và Body Parser
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Bộ nhớ tạm trong RAM
const otpStore = {};       // Lưu OTP chờ xác thực
const registeredUsers = [  // Danh sách tài khoản đã xác thực thành công
  { email: 'admin@gmail.com', password: '123456' }
];

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER || 'chiloc07102002@gmail.com',
    pass: process.env.MAIL_PASS || 'pxznrlvtjfebcpqv',
  },
  tls: { rejectUnauthorized: false }
});

// 1. ROUTE ĐĂNG KÝ VÀ GỬI OTP
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email và Mật khẩu!' });
  }

  // Kiểm tra nếu email đã tồn tại
  const existingUser = registeredUsers.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email này đã được đăng ký tài khoản!' });
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Lưu thông tin kèm mật khẩu tạm vào RAM (5 phút)
  otpStore[email] = { 
    otp: generatedOtp, 
    password: password, 
    expiresAt: Date.now() + 5 * 60 * 1000 
  };

  try {
    await transporter.sendMail({
      from: `"Chợ Đồ Cũ" <${process.env.MAIL_USER || 'chiloc07102002@gmail.com'}>`,
      to: email,
      subject: `[${generatedOtp}] Mã xác thực đăng ký tài khoản Chợ Đồ Cũ`,
      text: `Mã OTP của bạn là: ${generatedOtp}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho ai.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-bottom: 10px;">Xác thực tài khoản</h2>
          <p style="color: #374151; font-size: 15px;">Xin chào,</p>
          <p style="color: #374151; font-size: 15px;">Cảm ơn bạn đã đăng ký tại <b>Chợ Đồ Cũ</b>. Mã OTP của bạn là:</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <span style="background-color: #f3f4f6; color: #111827; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 24px; border-radius: 6px; border: 1px dashed #6b7280; display: inline-block;">
              ${generatedOtp}
            </span>
          </div>

          <p style="color: #6b7280; font-size: 13px;">Mã có hiệu lực trong <b>5 phút</b>.</p>
        </div>
      `,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    });

    return res.status(200).json({ message: 'Đã gửi mã OTP thành công!' });
  } catch (error) {
    console.error('Lỗi gửi mail đăng ký:', error);
    return res.status(500).json({ message: 'Lỗi gửi OTP: ' + error.message });
  }
});

// 2. ROUTE GỬI LẠI MÃ OTP
app.post('/api/auth/resend', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Thiếu email!' });
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { 
    ...otpStore[email],
    otp: generatedOtp, 
    expiresAt: Date.now() + 5 * 60 * 1000 
  };

  try {
    await transporter.sendMail({
      from: `"Chợ Đồ Cũ" <${process.env.MAIL_USER || 'chiloc07102002@gmail.com'}>`,
      to: email,
      subject: `[${generatedOtp}] Yêu cầu gửi lại mã OTP - Chợ Đồ Cũ`,
      text: `Mã OTP mới của bạn là: ${generatedOtp}. Mã có hiệu lực trong 5 phút.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Mã OTP Mới Nhất</h2>
          <p style="color: #374151;">Bạn vừa yêu cầu gửi lại mã xác thực. Mã mới của bạn là:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="background-color: #f3f4f6; color: #111827; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 10px 20px; border-radius: 6px; display: inline-block;">
              ${generatedOtp}
            </span>
          </div>
        </div>
      `,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    });

    return res.status(200).json({ message: 'Đã gửi lại mã OTP thành công!' });
  } catch (err) {
    console.error('Lỗi gửi lại mail:', err);
    return res.status(500).json({ message: 'Không thể gửi lại mã OTP!' });
  }
});

// 3. ROUTE XÁC THỰC OTP VÀ TẠO TÀI KHOẢN
app.post('/api/auth/verify', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({ message: 'Mã OTP đã hết hạn hoặc không tồn tại!' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Mã OTP không chính xác!' });
  }

  // Xác nhận thành công -> Lưu user vào danh sách hệ thống
  registeredUsers.push({
    email: email,
    password: record.password
  });

  // Xóa mã tạm khỏi RAM
  delete otpStore[email];

  return res.status(200).json({ message: 'Xác thực tài khoản thành công! Bây giờ bạn có thể đăng nhập.' });
});

// 4. ROUTE ĐĂNG NHẬP THẬT
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Gmail và mật khẩu!' });
  }

  // Tìm user trong danh sách đã đăng ký
  const user = registeredUsers.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(400).json({ message: 'Gmail hoặc mật khẩu không chính xác!' });
  }

  return res.status(200).json({
    message: 'Đăng nhập thành công!',
    user: { email: user.email }
  });
});

// Khởi chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});