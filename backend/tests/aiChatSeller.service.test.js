'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  exactSellerNameMatch,
  extractSellerName,
  hasSellerNameDiacritics,
} = require('../src/services/aiChatSeller.service');

test('seller extraction removes honorifics and preserves Vietnamese accents', () => {
  assert.equal(extractSellerName('Chị Ánh bán gì?'), 'ánh');
  assert.equal(extractSellerName('Anh Phúc đang bán những gì?'), 'phúc');
  assert.equal(extractSellerName('Sản phẩm của cô Hồng'), 'hồng');
});

test('seller matching distinguishes accented names from unaccented names', () => {
  assert.equal(hasSellerNameDiacritics('Ánh'), true);
  assert.equal(hasSellerNameDiacritics('Anh'), false);
  assert.equal(exactSellerNameMatch('Nguyễn Thị Ánh', 'Ánh'), true);
  assert.equal(exactSellerNameMatch('Nguyễn Văn Anh', 'Ánh'), false);
  assert.equal(exactSellerNameMatch('Nguyễn Thị Ánh', 'Nguyễn Thị Ánh'), true);
});
