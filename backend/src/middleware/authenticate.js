'use strict';

const crypto = require('crypto');
const AppError = require('../errors/AppError');

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch (_error) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, 'AUTH_NOT_CONFIGURED', 'Dịch vụ xác thực chưa được cấu hình.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodePart(encodedHeader);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let actual;

  try {
    actual = Buffer.from(signature, 'base64url');
  } catch (_error) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }

  const payload = decodePart(encodedPayload);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp <= nowInSeconds) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn.');
  }

  const userId = Number(payload.sub ?? payload.userId ?? payload.UserId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ.');
  }

  return { ...payload, userId };
}

function authenticate(request, response, next) {
  // Require trễ để verifyToken và middleware dùng chung không tạo vòng khởi tạo.
  return require('../middlewares/auth.middleware').requireTokenAuth(request, response, next);
}

module.exports = { authenticate, verifyToken };
