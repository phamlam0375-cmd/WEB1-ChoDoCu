'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectAvailability,
  detectChatIntent,
  extractComparisonNames,
  resolveProductByName,
} = require('../src/services/aiChatActions.service');

test('nhận diện các câu hỏi giá, so sánh, tình trạng và tồn kho bằng tiếng Việt', () => {
  assert.equal(detectChatIntent('Món nào rẻ nhất?'), 'CHEAPEST');
  assert.equal(detectChatIntent('Sản phẩm mắc nhất là gì?'), 'MOST_EXPENSIVE');
  assert.equal(detectChatIntent('So sánh iPhone 11 với Samsung A52'), 'COMPARE');
  assert.equal(detectChatIntent('iPhone này còn xài tốt không?'), 'CONDITION');
  assert.equal(detectChatIntent('Điện thoại nào còn hàng?'), 'AVAILABILITY');
  assert.equal(detectAvailability('iPhone 11 còn hàng không?'), 'CHECK');
  assert.equal(
    detectAvailability('Sản phẩm nào còn hàng hay hết hàng?'),
    'ANY'
  );
});

test('tách tên hai sản phẩm được so sánh sau khi bỏ dấu tiếng Việt', () => {
  assert.deepEqual(
    extractComparisonNames('So sánh iPhone 11 với Samsung A52 nhé'),
    ['iphone 11', 'samsung a52']
  );
});

test('chỉ chọn duy nhất sản phẩm phù hợp, không tự đoán khi tên bị mơ hồ', () => {
  const products = [
    { ListingId: 1, Title: 'iPhone 11 64GB' },
    { ListingId: 2, Title: 'iPhone 11 Pro' },
    { ListingId: 3, Title: 'Samsung A52' },
  ];

  assert.equal(
    resolveProductByName('Samsung A52', products).product.ListingId,
    3
  );
  const ambiguous = resolveProductByName('iPhone 11', products);
  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.options.length, 2);
});
