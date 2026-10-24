'use strict';

const DEVELOPMENT_JWT_SECRET = 'cho-do-cu-local-development-only-jwt-secret';

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    return DEVELOPMENT_JWT_SECRET;
  }

  throw new Error('Thiếu JWT_SECRET trong cấu hình backend.');
}

module.exports = { getJwtSecret };
