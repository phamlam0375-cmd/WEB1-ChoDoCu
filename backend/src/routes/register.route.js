require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sequelize = require('../database');
const { Users, Roles, UserRoles, VerificationCodes } = require('../models');
const { sendOtpEmail } = require('../services/otpMailer');
const { getJwtSecret } = require('../utils/jwtSecret');

const router = express.Router();

const OTP_PURPOSE = 'EMAIL_VERIFICATION';
const OTP_CHANNEL = 'EMAIL';
const OTP_EXPIRY_MS = 10 * 60 * 1000;

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const normalizeOtp = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6);

const createToken = (userId) => {
  const secret = getJwtSecret();

  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: userId, iat: now, exp: now + 8 * 60 * 60 });
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
};

const createUsername = async (email, transaction) => {
  const localPart = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
  const base = localPart || 'user';
  let username = base;
  let suffix = 1;

  while (await Users.findOne({ where: { Username: username }, transaction })) {
    const suffixText = `_${suffix}`;
    username = `${base.slice(0, 50 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return username;
};

const getUserRole = async (transaction) => {
  const role = await Roles.findOne({ where: { RoleName: 'USER' }, transaction });
  if (!role) {
    throw new Error('Chưa cấu hình vai trò USER trong cơ sở dữ liệu.');
  }
  return role;
};

const createLoginResponse = (user, message) => ({
  success: true,
  message,
  token: createToken(user.UserId),
  user: {
    UserId: user.UserId,
    Username: user.Username,
    FullName: user.FullName,
    Email: user.Email,
    AvatarUrl: user.AvatarUrl
  }
});

const sendOTPCode = async (toEmail, otpCode) => {
  return sendOtpEmail({
    to: toEmail,
    code: otpCode,
    purpose: 'registration',
    subject: 'Mã xác thực OTP - Đăng ký tài khoản',
    html: `<p>Mã OTP xác thực tài khoản của bạn là: <b style="font-size: 18px; color: #007bff;">${otpCode}</b></p><p>Mã có hiệu lực trong 10 phút.</p>`
  });
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email và Mật khẩu!' });
  }

  const cleanEmail = normalizeEmail(email);
  const user = await Users.unscoped().findOne({ where: { Email: cleanEmail } });

  if (!user) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
  }

  if (!user.EmailVerified) {
    return res.status(403).json({ message: 'Vui lòng xác thực email trước khi đăng nhập.' });
  }

  if (user.Status !== 'ACTIVE') {
    return res.status(403).json({ message: 'Tài khoản của bạn hiện không thể đăng nhập.' });
  }

  const passwordMatches = await bcrypt.compare(password, user.PasswordHash || '');
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
  }

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công!',
    token: createToken(user.UserId),
    user: {
      UserId: user.UserId,
      Username: user.Username,
      FullName: user.FullName,
      Email: user.Email,
      AvatarUrl: user.AvatarUrl
    }
  });
});

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({ message: 'Đăng nhập Google chưa được cấu hình.' });
  }
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ message: 'Thiếu thông tin xác thực Google.' });
  }

  let payload;
  try {
    const response = await fetch('https://oauth2.googleapis.com/tokeninfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: credential }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      return res.status(401).json({ message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.' });
    }
    payload = await response.json();
    if (
      payload.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) ||
      Number(payload.exp) * 1000 <= Date.now()
    ) {
      return res.status(401).json({ message: 'Token Google không hợp lệ hoặc đã hết hạn.' });
    }
  } catch (error) {
    console.error('Không thể xác minh token Google:', error);
    return res.status(401).json({ message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.' });
  }

  if (
    !payload?.sub ||
    !payload.email ||
    ![true, 'true'].includes(payload.email_verified)
  ) {
    return res.status(401).json({ message: 'Tài khoản Google chưa xác minh email.' });
  }

  const email = normalizeEmail(payload.email);

  try {
    const user = await sequelize.transaction(async (transaction) => {
      let account = await Users.unscoped().findOne({
        where: { GoogleId: payload.sub },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!account) {
        account = await Users.unscoped().findOne({
          where: { Email: email },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
      }

      if (account?.GoogleId && account.GoogleId !== payload.sub) {
        throw Object.assign(new Error('Email này đã liên kết với một tài khoản Google khác.'), { status: 409 });
      }

      const role = await getUserRole(transaction);
      if (!account) {
        account = await Users.create({
          Username: await createUsername(email, transaction),
          FullName: String(payload.name || email.split('@')[0]).slice(0, 100),
          Email: email,
          GoogleId: payload.sub,
          AvatarUrl: payload.picture || null,
          EmailVerified: true,
          Status: 'ACTIVE'
        }, { transaction });
      } else {
        if (account.Status !== 'ACTIVE') {
          throw Object.assign(new Error('Tài khoản của bạn hiện không thể đăng nhập.'), { status: 403 });
        }
        await account.update({
          GoogleId: payload.sub,
          EmailVerified: true,
          AvatarUrl: account.AvatarUrl || payload.picture || null
        }, { transaction });
      }

      const userRole = await UserRoles.findOne({
        where: { UserId: account.UserId, RoleId: role.RoleId },
        transaction
      });
      if (!userRole) {
        await UserRoles.create({
          UserId: account.UserId,
          RoleId: role.RoleId
        }, { transaction });
      }

      return account;
    });

    return res.status(200).json(createLoginResponse(user, 'Đăng nhập Google thành công!'));
  } catch (error) {
    if (error.status === 403 || error.status === 409) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Lỗi đăng nhập Google:', error);
    return res.status(500).json({ message: 'Không thể đăng nhập bằng Google lúc này.' });
  }
});

// 1. API ĐĂNG KÝ
router.post('/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập họ tên, email và mật khẩu!' });
  }

  try {
    const cleanEmail = normalizeEmail(email);
    const cleanFullName = String(fullName).trim();
    if (!cleanFullName || cleanFullName.length > 100) {
      return res.status(400).json({ message: 'Họ tên phải có từ 1 đến 100 ký tự.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Mật khẩu tối thiểu 8 ký tự.' });
    }
    if (cleanEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Email không hợp lệ.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await sequelize.transaction(async (transaction) => {
      let user = await Users.unscoped().findOne({
        where: { Email: cleanEmail },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (user?.EmailVerified) {
        throw Object.assign(new Error('Email này đã tồn tại trong hệ thống!'), { status: 409 });
      }

      const userRole = await Roles.findOne({ where: { RoleName: 'USER' }, transaction });
      if (!userRole) {
        throw new Error('Chưa cấu hình vai trò USER trong cơ sở dữ liệu.');
      }

      if (user) {
        await user.update({
          FullName: cleanFullName,
          PasswordHash: passwordHash
        }, { transaction });
      } else {
        user = await Users.create({
          Username: await createUsername(cleanEmail, transaction),
          PasswordHash: passwordHash,
          FullName: cleanFullName,
          Email: cleanEmail,
          EmailVerified: false,
          Status: 'ACTIVE'
        }, { transaction });
      }

      const existingRole = await UserRoles.findOne({
        where: { UserId: user.UserId, RoleId: userRole.RoleId },
        transaction
      });
      if (!existingRole) {
        await UserRoles.create({
          UserId: user.UserId,
          RoleId: userRole.RoleId
        }, { transaction });
      }

      await VerificationCodes.update(
        { UsedAt: new Date() },
        {
          where: {
            Recipient: cleanEmail,
            Channel: OTP_CHANNEL,
            Purpose: OTP_PURPOSE,
            UsedAt: null
          },
          transaction
        }
      );
      await VerificationCodes.create({
        UserId: user.UserId,
        Recipient: cleanEmail,
        Channel: OTP_CHANNEL,
        Purpose: OTP_PURPOSE,
        CodeHash: codeHash,
        ExpiresAt: expiresAt
      }, { transaction });
    });

    const delivery = await sendOTPCode(cleanEmail, otpCode);

    return res.status(200).json({
      success: true,
      delivery: delivery.delivery,
      message: delivery.delivery === 'development-log'
        ? 'Tạo tài khoản thành công. Xem mã OTP trong log backend.'
        : 'Đăng ký thành công! Vui lòng kiểm tra mã OTP trong email.',
    });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    console.error('Lỗi đăng ký tài khoản:', error);
    return res.status(500).json({ message: 'Không thể đăng ký tài khoản lúc này. Vui lòng thử lại!' });
  }
});

// 2. API GỬI LẠI MÃ OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return res.status(400).json({ message: 'Vui lòng nhập email hợp lệ!' });
  }

  try {
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    const user = await Users.findOne({
      where: { Email: cleanEmail, EmailVerified: false }
    });

    if (!user) {
      return res.status(400).json({ message: 'Không tìm thấy tài khoản chưa xác thực cho email này.' });
    }

    await sequelize.transaction(async (transaction) => {
      await VerificationCodes.update(
        { UsedAt: new Date() },
        {
          where: {
            Recipient: cleanEmail,
            Channel: OTP_CHANNEL,
            Purpose: OTP_PURPOSE,
            UsedAt: null
          },
          transaction
        }
      );
      await VerificationCodes.create({
        UserId: user.UserId,
        Recipient: cleanEmail,
        Channel: OTP_CHANNEL,
        Purpose: OTP_PURPOSE,
        CodeHash: codeHash,
        ExpiresAt: expiresAt
      }, { transaction });
    });

    const delivery = await sendOTPCode(cleanEmail, otpCode);
    return res.status(200).json({
      success: true,
      delivery: delivery.delivery,
      message: delivery.delivery === 'development-log'
        ? 'Đã tạo mã OTP mới. Xem mã trong log backend.'
        : 'Đã gửi lại mã OTP mới vào email.'
    });
  } catch (error) {
    console.error('Lỗi gửi lại OTP:', error);
    return res.status(500).json({ message: 'Không thể gửi lại mã OTP. Vui lòng thử lại!' });
  }
});

// 3. API XÁC THỰC OTP
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email và Mã OTP!' });
  }

  const cleanEmail = normalizeEmail(email);
  const cleanOtp = normalizeOtp(otp);

  if (cleanOtp.length !== 6) {
    return res.status(400).json({ message: 'Mã OTP không hợp lệ! Vui lòng nhập đúng 6 chữ số.' });
  }

  const user = await Users.findOne({
    where: { Email: cleanEmail, EmailVerified: false }
  });
  if (!user) {
    return res.status(400).json({ message: 'Mã OTP không tồn tại hoặc đã hết hạn!' });
  }

  const verificationCode = await VerificationCodes.findOne({
    where: {
      UserId: user.UserId,
      Recipient: cleanEmail,
      Channel: OTP_CHANNEL,
      Purpose: OTP_PURPOSE,
      UsedAt: null
    },
    order: [['CreatedAt', 'DESC']]
  });

  if (!verificationCode || new Date(verificationCode.ExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Mã OTP đã hết hạn!' });
  }

  if (!await bcrypt.compare(cleanOtp, verificationCode.CodeHash)) {
    return res.status(400).json({ message: 'Mã OTP không chính xác!' });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const lockedUser = await Users.unscoped().findOne({
        where: { UserId: user.UserId, Email: cleanEmail, EmailVerified: false },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const lockedCode = await VerificationCodes.findOne({
        where: {
          VerificationId: verificationCode.VerificationId,
          UserId: user.UserId,
          UsedAt: null
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedUser || !lockedCode || new Date(lockedCode.ExpiresAt).getTime() < Date.now()) {
        throw Object.assign(new Error('Mã OTP đã được sử dụng hoặc đã hết hạn.'), { status: 400 });
      }

      await lockedUser.update({ EmailVerified: true }, { transaction });
      await lockedCode.update({ UsedAt: new Date() }, { transaction });
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Lỗi xác thực email:', error);
    return res.status(500).json({ message: 'Không thể xác thực email. Vui lòng thử lại!' });
  }

  return res.status(200).json({
    success: true,
    message: 'Xác thực tài khoản thành công!',
  });
});


// Dev-only mock identities are restricted to example.test to avoid impersonating shared DB accounts.
router.post('/google/dev', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'Đăng nhập mock chỉ dùng được trong môi trường development.' });
    }

    const emailRaw = (req.body && req.body.email) || '';
    const email = String(emailRaw).trim().toLowerCase();
    if (!/^[^\s@]+@example\.test$/.test(email)) {
      return res.status(400).json({ message: 'Mock Google chỉ chấp nhận email thử nghiệm dạng ten@example.test.' });
    }

    const devGoogleId = `dev:${email}`;

    const user = await sequelize.transaction(async (transaction) => {
      let account = await Users.unscoped().findOne({
        where: { Email: email },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (account && account.GoogleId !== devGoogleId) {
        throw Object.assign(new Error('Email thử nghiệm này đã được dùng bởi tài khoản khác.'), { status: 409 });
      }
      if (account && account.Status !== 'ACTIVE') {
        throw Object.assign(new Error('Tài khoản thử nghiệm hiện không thể đăng nhập.'), { status: 403 });
      }

      const role = await getUserRole(transaction);
      if (!account) {
        account = await Users.create({
          Username: await createUsername(email, transaction),
          FullName: email.split('@')[0],
          Email: email,
          EmailVerified: true,
          GoogleId: devGoogleId,
          PasswordHash: null,
          Status: 'ACTIVE'
        }, { transaction });
      }

      const userRole = await UserRoles.findOne({
        where: { UserId: account.UserId, RoleId: role.RoleId },
        transaction
      });
      if (!userRole) {
        await UserRoles.create({
          UserId: account.UserId,
          RoleId: role.RoleId
        }, { transaction });
      }

      return account;
    });

    return res.json(createLoginResponse(user, 'Đăng nhập Google thử nghiệm thành công.'));
  } catch (err) {
    if (err.status === 403 || err.status === 409) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Error in /auth/google/dev', err);
    return res.status(500).json({ message: 'Không thể đăng nhập bằng Google thử nghiệm lúc này.' });
  }
});

module.exports = router;