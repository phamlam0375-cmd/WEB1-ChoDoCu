'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { UPLOAD_DIR } = require('../../controllers/uploads.controller');
// Tái sử dụng kho upload chung. Dot-directory không được express.static phục vụ;
// chỉ endpoint kiểm tra quyền mới đọc được ảnh theo chuyến.
// Database test không trộn file bằng chứng với database đang dùng.
const namespace = crypto.createHash('sha256').update(require('../../database').getDatabaseName()).digest('hex').slice(0, 16);
const directory = path.join(UPLOAD_DIR, '.d08', namespace);
function resolve(key) {
  if (typeof key !== 'string' || !/^d08-[0-9a-f-]{36}\.(?:png|jpg)$/.test(key)) throw new Error('D08 invalid storage key');
  return { target: path.join(directory, key), mime: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}
async function save(buffer, extension) {
  const key = `d08-${crypto.randomUUID()}.${extension}`, file = resolve(key);
  await fs.mkdir(directory, { recursive: true });
  try { await fs.writeFile(file.target, buffer, { flag: 'wx' }); }
  catch (error) {
    // Không xóa file đã có nếu wx báo trùng tên (dù xác suất UUID rất nhỏ).
    if (error.code !== 'EEXIST') await fs.unlink(file.target).catch(() => {});
    throw error;
  }
  return { key, ...file };
}
const remove = file => fs.unlink(resolve(file.key).target);
module.exports = { save, remove, resolve, directory };
