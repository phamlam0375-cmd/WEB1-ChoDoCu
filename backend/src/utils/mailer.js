require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // 587 sử dụng STARTTLS
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendOTPCode = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"ChoĐồCũ Support" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: 'Mã xác thực đăng ký tài khoản ChoĐồCũ',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f7f6;">
        <div style="max-width: 400px; margin: auto; background: white; padding: 30px; border-radius: 16px; text-align: center;">
          <h2 style="color: #009966;">ChoĐồCũ</h2>
          <p style="color: #4b5563;">Mã xác thực OTP của bạn là:</p>
          <div style="background-color: #e6f7f0; border-radius: 12px; padding: 12px; margin: 20px 0;">
            <span style="color: #009966; font-size: 32px; font-weight: bold; letter-spacing: 6px;">${otpCode}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho ai.</p>
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPCode };