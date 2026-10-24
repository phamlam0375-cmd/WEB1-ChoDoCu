'use strict';
// Chỉ helper unit test, không được import từ src/runtime.
const crypto = require('node:crypto');
module.exports = function tokenFor(userId, exp = Math.floor(Date.now() / 1000) + 60) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp })}`;
  return `${body}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url')}`;
};
