'use strict';
const crypto = require('node:crypto');
const { getJwtSecret } = require('../../utils/jwtSecret');
const { HttpError } = require('../../utils/httpError');
// Khóa dẫn xuất riêng mục đích, không phải JWT/access token. Không lưu trong RAM.
const key = () => crypto.createHmac('sha256', getJwtSecret()).update('cho-do-cu:D12:delivery-quote:v1').digest();
const mac = text => crypto.createHmac('sha256', key()).update(text).digest('base64url');
function sign(payload) {
  const body = `d12.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${body}.${mac(body)}`;
}
function read(token) {
  const invalid = () => new HttpError(422, 'Báo giá giao hàng không hợp lệ. Vui lòng tính lại phí.', null, 'DELIVERY_QUOTE_INVALID');
  if (typeof token !== 'string' || token.length > 8192 || !/^d12\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
  const [prefix, body, signature] = token.split('.'), expected = mac(`${prefix}.${body}`);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw invalid();
  try { const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); if (data.type !== 'D12_QUOTE' || data.version !== 1) throw invalid(); return data; }
  catch { throw invalid(); }
}
module.exports = { sign, read };
