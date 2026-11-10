'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { UPLOAD_DIR, MAX_BYTES } = require('../controllers/uploads.controller');
const namespace = crypto.createHash('sha256').update(require('../database').getDatabaseName()).digest('hex').slice(0, 16);
function createProofStorage(purpose) {
  if (!['d08', 'd13'].includes(purpose)) throw new Error('Invalid delivery proof purpose');
  const directory = path.join(UPLOAD_DIR, `.${purpose}`, namespace);
  function resolve(key) {
    if (typeof key !== 'string' || !new RegExp(`^${purpose}-[0-9a-f-]{36}\\.(?:png|jpg)$`).test(key)) throw new Error('Invalid delivery proof key');
    return { target: path.join(directory, key), mime: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }
  async function save(buffer, extension) {
    const key = `${purpose}-${crypto.randomUUID()}.${extension}`, file = resolve(key);
    await fs.mkdir(directory, { recursive: true });
    try { await fs.writeFile(file.target, buffer, { flag: 'wx' }); }
    catch (e) { if (e.code !== 'EEXIST') await fs.unlink(file.target).catch(() => {}); throw e; }
    return { key, ...file };
  }
  const remove = file => fs.unlink(resolve(file.key).target);
  async function valid(key, digest) {
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return false;
    try {
      const file = resolve(key), stat = await fs.stat(file.target);
      return stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES && crypto.createHash('sha256').update(await fs.readFile(file.target)).digest('hex') === digest;
    } catch { return false; }
  }
  return { save, remove, resolve, valid, directory };
}
module.exports = { createProofStorage };
