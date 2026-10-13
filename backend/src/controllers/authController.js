const bcrypt = require('bcrypt');
const db = require('../config/db'); // Đường dẫn import DB của bạn
const { sendOTPCode } = require('../../../frontend/src/utils/mailer'); // Import hàm từ file ở Bước 1

const register = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Kiểm tra email trùng
    const [existing] = await db.query('SELECT * FROM Users WHERE Email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email này đã được đăng ký!' });
    }

    // 2. Hash mật khẩu và lưu vào DB Users
    const passwordHash = await bcrypt.hash(password, 10);
    const username = email.split('@')[0];
    const [userResult] = await db.query(
      `INSERT INTO Users (Username, PasswordHash, Email, EmailVerified, Status) VALUES (?, ?, ?, 0, 'ACTIVE')`,
      [username, passwordHash, email]
    );

    // 3. Tạo mã OTP 6 số và lưu vào DB VerificationCodes
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO VerificationCodes (UserId, Code, Type, ExpiresAt, IsUsed) VALUES (?, ?, 'EMAIL_VERIFICATION', ?, 0)`,
      [userResult.insertId, otpCode, expiresAt]
    );

    // 4. GỬI EMAIL CHỨA MÃ OTP TẠI ĐÂY 🚀
    await sendOTPCode(email, otpCode);

    return res.status(200).json({
      success: true,
      message: 'Đăng ký thành công! Vui lòng kiểm tra email nhận mã OTP.',
    });

  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    return res.status(500).json({ message: 'Lỗi hệ thống máy chủ!' });
  }
};

module.exports = { register };