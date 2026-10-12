'use strict';

const zlib = require('node:zlib');
const jpeg = require('jpeg-js');
const { HttpError } = require('../../utils/httpError');
const { MAX_BYTES, INVALID_IMAGE_MESSAGE } = require('../../controllers/uploads.controller');
const { toCents } = require('../../utils/money');

const invalid = message => new HttpError(400, message, null, 'VALIDATION_ERROR');

function validateOrderId(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 4294967295) throw invalid('Mã đơn hàng không hợp lệ.');
  return Number(value);
}

function validateNotice(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'amount')) {
    throw invalid('Chỉ gửi biên lai và số tiền; người nhận, nội dung và trạng thái do máy chủ xác định.');
  }
  if (body.amount !== undefined && (typeof body.amount !== 'string' || !/^\d{1,16}(?:\.\d{1,2})?$/.test(body.amount))) throw invalid('Số tiền không hợp lệ.');
  return body.amount;
}

function matchesAmount(amount, expected) {
  try { return toCents(amount) === toCents(expected); } catch { return false; }
}

function bankDetails(store) {
  const bankName = store?.BankName?.trim();
  const accountNumber = store?.BankAccountNumber?.trim();
  const accountHolder = store?.BankAccountHolder?.trim();
  if (!bankName || bankName.length > 80 || !/^[0-9]{1,30}$/.test(accountNumber || '') || !accountHolder || accountHolder.length > 100
    || /[\x00-\x1f\x7f]/.test(bankName + accountHolder)) return null;
  return { bankName, accountNumber, accountHolder };
}

function snapshotBank(payment) {
  return bankDetails({ BankName: payment?.BankName, BankAccountNumber: payment?.BankAccountSnapshot, BankAccountHolder: payment?.BankAccountHolderSnapshot });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// PNG: kiểm tra cấu trúc, CRC và giải nén IDAT; không chỉ nhận diện magic byte.
function pngValid(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return false;
  let offset = 8, header, palette = false, endedData = false;
  const data = [];
  while (offset + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(offset), end = offset + 12 + size;
    if (end > buffer.length) return false;
    const name = buffer.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(name) || crc32(buffer.subarray(offset + 4, end - 4)) !== buffer.readUInt32BE(end - 4)) return false;
    const bytes = buffer.subarray(offset + 8, end - 4);
    if (!header && name !== 'IHDR') return false;
    if (name === 'IHDR') {
      if (header || size !== 13) return false;
      header = bytes;
    } else if (name === 'PLTE') { if (data.length || !size || size > 768 || size % 3) return false; palette = true; }
    else if (name === 'IDAT') { if (endedData) return false; data.push(bytes); }
    else if (name === 'IEND') {
      if (size || end !== buffer.length || !data.length) return false;
      const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], color = header[9], interlace = header[12];
      const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width * height > 20000000 || !validDepths[color]?.includes(depth) || header[10] || header[11] || interlace > 1 || (color === 3 && !palette)) return false;
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
      const raw = zlib.inflateSync(Buffer.concat(data), { maxOutputLength: 170000000 });
      const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
      let index = 0;
      for (const [x, y, dx, dy] of passes) {
        const pw = Math.max(0, Math.ceil((width - x) / dx)), ph = Math.max(0, Math.ceil((height - y) / dy));
        if (!pw || !ph) continue;
        const stride = Math.ceil(pw * depth * channels / 8) + 1;
        for (let row = 0; row < ph; row++) { if (index + stride > raw.length || raw[index] > 4) return false; index += stride; }
      }
      return index === raw.length;
    } else {
      if (data.length) endedData = true;
      if (name[0] === name[0].toUpperCase()) return false;
    }
    offset = end;
  }
  return false;
}

// JPEG: duyệt các segment/scan, kích thước ảnh và EOI; từ chối file cắt cụt hoặc giả đầu JPEG.
function jpegValid(buffer) {
  if (buffer.readUInt16BE(0) !== 0xffd8) return false;
  let offset = 2, frame = false, scan = false;
  while (offset < buffer.length) {
    if (buffer[offset++] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9) return frame && scan && offset === buffer.length;
    if (!marker || marker === 0xd8 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7 || offset + 2 > buffer.length) return false;
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) return false;
      const height = buffer.readUInt16BE(offset + 3), width = buffer.readUInt16BE(offset + 5), components = buffer[offset + 7];
      if (!width || !height || width * height > 20000000 || ![1, 3, 4].includes(components) || size !== 8 + 3 * components || buffer[offset + 2] !== 8) return false;
      frame = true;
    }
    offset += size;
    if (marker === 0xda) {
      if (!frame || size < 6) return false;
      scan = true;
      const scanStart = offset;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        if (buffer[offset + 1] === 0x00 || buffer[offset + 1] >= 0xd0 && buffer[offset + 1] <= 0xd7) { offset += 2; continue; }
        break;
      }
      if (offset === scanStart) return false;
    }
  }
  return false;
}

function validateProof(file) {
  if (!file?.buffer?.length) throw invalid('Vui lòng tải ảnh biên lai chuyển khoản.');
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BYTES) throw invalid(INVALID_IMAGE_MESSAGE);
  try {
    if (buffer.length > 8 && pngValid(buffer)) return 'png';
    if (buffer.length > 8 && jpegValid(buffer)) {
      const decoded = jpeg.decode(buffer, { useTArray: true, tolerantDecoding: false, maxResolutionInMP: 20, maxMemoryUsageInMB: 170 });
      if (decoded.width && decoded.height && decoded.data.length) return 'jpg';
    }
  } catch { /* Các lỗi giải nén/offset đều là chứng từ không hợp lệ. */ }
  throw invalid(INVALID_IMAGE_MESSAGE);
}

module.exports = { validateOrderId, validateNotice, matchesAmount, bankDetails, snapshotBank, validateProof };
