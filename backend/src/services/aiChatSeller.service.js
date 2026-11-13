'use strict';

const TITLE = '(?:(?:anh|chị|chi|cô|co|chú|chu|bạn|ban)\\s+)?';
const SELLER_QUESTION = [
  'đang\\s+bán\\s+những\\s+gì',
  'dang\\s+ban\\s+nhung\\s+gi',
  'đang\\s+bán\\s+gì',
  'dang\\s+ban\\s+gi',
  'đang\\s+có\\s+gì',
  'dang\\s+co\\s+gi',
  'bán\\s+những\\s+gì',
  'ban\\s+nhung\\s+gi',
  'bán\\s+gì',
  'ban\\s+gi',
  'có\\s+bán\\s+gì',
  'co\\s+ban\\s+gi',
  'có\\s+những\\s+gì',
  'co\\s+nhung\\s+gi',
  'có\\s+sản\\s+phẩm\\s+gì',
  'co\\s+san\\s+pham\\s+gi',
  'có\\s+món\\s+gì',
  'co\\s+mon\\s+gi',
].join('|');

function normalizeSellerName(value) {
  return String(value ?? '')
    .toLocaleLowerCase('vi-VN')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSellerNameDiacritics(value) {
  return /[\u0300-\u036f]/.test(
    String(value ?? '').normalize('NFD')
  ) || /[đĐ]/.test(String(value ?? ''));
}

function exactSellerNameMatch(fullName, query) {
  const full = normalizeSellerName(fullName);
  const wanted = normalizeSellerName(query);

  return Boolean(
    full &&
    wanted &&
    (` ${full} `).includes(` ${wanted} `)
  );
}

function extractSellerName(text) {
  const input = String(text ?? '')
    .toLocaleLowerCase('vi-VN')
    .normalize('NFC')
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    new RegExp(
      `^${TITLE}(.+?)\\s+(?:${SELLER_QUESTION})(?:\\s+(?:không|khong|ko|k|vậy|vay|nhỉ|nhi|ạ|a|hả|ha))?$`,
      'i'
    ),
    new RegExp(
      `^(?:sản phẩm|san pham|đồ|do|hàng|hang|món|mon)\\s+(?:của|cua)\\s+${TITLE}(.+?)(?:\\s+(?:giá|gia|dưới|duoi|trên|tren|từ|tu)\\s+|$)`,
      'i'
    ),
    new RegExp(
      `^${TITLE}(.+?)\\s+(?:đang bán|dang ban|có bán|co ban)\\s+(?:những gì|nhung gi|gì|gi|sản phẩm gì|san pham gi)$`,
      'i'
    ),
    new RegExp(
      `^(?:tìm|tim|xem)\\s+(?:đồ|do|hàng|hang|sản phẩm|san pham)\\s+(?:của|cua)\\s+${TITLE}(.+?)$`,
      'i'
    ),
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

module.exports = {
  exactSellerNameMatch,
  extractSellerName,
  hasSellerNameDiacritics,
  normalizeSellerName,
};
