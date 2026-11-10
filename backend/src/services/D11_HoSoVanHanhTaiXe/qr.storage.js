'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { UPLOAD_DIR, MAX_BYTES } = require('../../controllers/uploads.controller');
const { validateProof } = require('../../validators/D03_ThanhToan/payment.validator');
const namespace = crypto.createHash('sha256').update(require('../../database').getDatabaseName()).digest('hex').slice(0, 16);
const directory = path.join(UPLOAD_DIR, '.d11', namespace);
const prefix = '/api/v1/driver/profile/qr/';
function resolve(userId, url) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0 || typeof url !== 'string' || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.(png|jpg)$/.test(key)) return null;
  return { target: path.join(directory, String(userId), key), url, mime: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}
async function valid(userId, url) {
  const file = resolve(userId, url);
  if (!file) return false;
  try {
    const stat = await fs.stat(file.target);
    if (!stat.isFile() || stat.size > MAX_BYTES) return false;
    return validateProof({ buffer: await fs.readFile(file.target) }) === (file.mime === 'image/png' ? 'png' : 'jpg');
  } catch { return false; }
}
async function save(userId, upload) {
  const extension = validateProof(upload);
  if (upload.mimetype !== (extension === 'png' ? 'image/png' : 'image/jpeg')) {
    const { HttpError } = require('../../utils/httpError');
    throw new HttpError(400, 'Loại ảnh QR không khớp nội dung JPG/PNG.', null, 'INVALID_QR');
  }
  const file = resolve(userId, `${prefix}${crypto.randomUUID()}.${extension}`);
  await fs.mkdir(path.dirname(file.target), { recursive: true });
  try { await fs.writeFile(file.target, upload.buffer, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') await fs.unlink(file.target).catch(() => {}); throw error; }
  return file;
}
const remove = file => fs.unlink(file.target).catch(() => {});
module.exports = { valid, save, resolve, remove, prefix };
