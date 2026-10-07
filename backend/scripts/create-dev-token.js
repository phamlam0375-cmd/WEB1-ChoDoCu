'use strict';

const crypto = require('crypto');
require('dotenv').config();

const userId = Number(process.argv[2]);
const secret = process.env.JWT_SECRET;

if (!Number.isSafeInteger(userId) || userId <= 0) {
  throw new Error('Cách dùng: pnpm auth:token <UserId>');
}
if (!secret) {
  throw new Error('Thiếu JWT_SECRET trong file .env.');
}

const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'HS256', typ: 'JWT' });
const payload = encode({ sub: userId, iat: now, exp: now + 8 * 60 * 60 });
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${header}.${payload}`)
  .digest('base64url');

console.log(`${header}.${payload}.${signature}`);
