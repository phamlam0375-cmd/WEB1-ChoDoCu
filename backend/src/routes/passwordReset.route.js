require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sequelize = require('../database');
const { Users, VerificationCodes } = require('../models');
const { sendOtpEmail, usesDevelopmentOtpLog } = require('../services/otpMailer');

const router = express.Router();

const OTP_CHANNEL = 'EMAIL';
const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const DEVELOPMENT_MODE = usesDevelopmentOtpLog();
const GENERIC_RESPONSE = {
  success: true,
  delivery: DEVELOPMENT_MODE ? 'development-log' : 'email',
  message: DEVELOPMENT_MODE
    ? 'Nếu email thuộc tài khoản hợp lệ, mã xác thực đã được tạo. Xem log backend trong development.'
    : 'Nếu email thuộc tài khoản hợp lệ, mã xác thực sẽ được gửi đến hộp thư của bạn.'
};

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const normalizeOtp = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6);

const sendPasswordResetCode = async (toEmail, otpCode) => {
  return sendOtpEmail({
    to: toEmail,
    code: otpCode,
    purpose: 'password-reset',
    subject: 'Mã xác thực đặt lại mật khẩu ChoĐồCũ',
    html: `<p>Mã xác thực đặt lại mật khẩu của bạn là: <b style="font-size: 18px; color: #007bff;">${otpCode}</b></p><p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>`
  });
};

router.post('/forgot-password', async (req, res) => {
  const cleanEmail = normalizeEmail(req.body?.email);

  if (!cleanEmail || cleanEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
  }

  try {
    const user = await Users.unscoped().findOne({
      where: { Email: cleanEmail, EmailVerified: true, Status: 'ACTIVE' }
    });

    if (!user) return res.status(200).json(GENERIC_RESPONSE);

    const recentCode = await VerificationCodes.findOne({
      where: {
        UserId: user.UserId,
        Recipient: cleanEmail,
        Channel: OTP_CHANNEL,
        Purpose: PASSWORD_RESET_PURPOSE
      },
      order: [['CreatedAt', 'DESC']]
    });

    if (recentCode && Date.now() - new Date(recentCode.CreatedAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(200).json(GENERIC_RESPONSE);
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    let verificationCode;

    await sequelize.transaction(async (transaction) => {
      await VerificationCodes.update(
        { UsedAt: new Date() },
        {
          where: {
            UserId: user.UserId,
            Recipient: cleanEmail,
            Channel: OTP_CHANNEL,
            Purpose: PASSWORD_RESET_PURPOSE,
            UsedAt: null
          },
          transaction
        }
      );

      verificationCode = await VerificationCodes.create({
        UserId: user.UserId,
        Recipient: cleanEmail,
        Channel: OTP_CHANNEL,
        Purpose: PASSWORD_RESET_PURPOSE,
        CodeHash: codeHash,
        ExpiresAt: expiresAt
      }, { transaction });
    });

    try {
      await sendPasswordResetCode(cleanEmail, otpCode);
    } catch (error) {
      await verificationCode.update({ UsedAt: new Date() });
      throw error;
    }

    return res.status(200).json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Lỗi yêu cầu đặt lại mật khẩu:', error);
    return res.status(500).json({ message: 'Không thể gửi mã đặt lại mật khẩu lúc này. Vui lòng thử lại sau.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const cleanEmail = normalizeEmail(req.body?.email);
  const cleanOtp = normalizeOtp(req.body?.otp);
  const { newPassword } = req.body || {};

  if (!cleanEmail || cleanEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Địa chỉ email không hợp lệ.' });
  }
  if (cleanOtp.length !== 6) {
    return res.status(400).json({ message: 'Mã xác thực phải gồm đúng 6 chữ số.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự và không vượt quá 72 byte.' });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await sequelize.transaction(async (transaction) => {
      const user = await Users.unscoped().findOne({
        where: { Email: cleanEmail, EmailVerified: true, Status: 'ACTIVE' },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!user) {
        throw Object.assign(new Error('Mã xác thực không hợp lệ hoặc đã hết hạn.'), { status: 400 });
      }

      const verificationCode = await VerificationCodes.findOne({
        where: {
          UserId: user.UserId,
          Recipient: cleanEmail,
          Channel: OTP_CHANNEL,
          Purpose: PASSWORD_RESET_PURPOSE,
          UsedAt: null
        },
        order: [['CreatedAt', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (
        !verificationCode ||
        new Date(verificationCode.ExpiresAt).getTime() <= Date.now() ||
        !await bcrypt.compare(cleanOtp, verificationCode.CodeHash)
      ) {
        throw Object.assign(new Error('Mã xác thực không hợp lệ hoặc đã hết hạn.'), { status: 400 });
      }

      await user.update({ PasswordHash: passwordHash }, { transaction });
      await verificationCode.update({ UsedAt: new Date() }, { transaction });
    });

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Lỗi đặt lại mật khẩu:', error);
    return res.status(500).json({ message: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
