'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  interpretMessage,
  normalizeInterpretation,
} = require('../src/services/aiChat.service');

function fakeResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Provider error',
    json: async () => data,
  };
}

test('trợ lý Gemini: phân tích yêu cầu bằng JSON và gửi lịch sử hội thoại', async () => {
  let request;
  const result = await interpretMessage({
    message: 'Tìm điện thoại dưới 500 nghìn',
    history: [
      { role: 'user', content: 'Mình đang tìm đồ cũ' },
      { role: 'assistant', content: 'Bạn muốn tìm loại nào?' },
    ],
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return fakeResponse({
        status: 'completed',
        steps: [{
          type: 'model_output',
          content: [{
              text: JSON.stringify({
                intent: 'SEARCH',
                keyword: 'điện thoại',
                sellerName: '',
                productName: '',
                compareProduct1: '',
                compareProduct2: '',
                availability: 'ANY',
                minPrice: 0,
                maxPrice: 500000,
                reply: '',
              }),
          }],
        }],
      });
    },
  });

  const body = JSON.parse(request.options.body);
  assert.match(request.url, /\/v1beta\/interactions$/);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  assert.equal(body.model, 'gemini-3.5-flash-lite');
  assert.equal(body.store, false);
  assert.equal(body.generation_config.thinking_level, 'low');
  assert.match(body.input, /Trợ lý: Bạn muốn tìm loại nào\?/);
  assert.match(body.input, /Tin nhắn mới nhất của người dùng: Tìm điện thoại dưới 500 nghìn/);
  assert.deepEqual(result, {
    intent: 'SEARCH',
    keyword: 'điện thoại',
    sellerName: '',
    productName: '',
    compareProduct1: '',
    compareProduct2: '',
    availability: 'ANY',
    minPrice: 0,
    maxPrice: 500000,
    reply: '',
  });
});

test('trợ lý Gemini: chuẩn hóa giá sai và giới hạn độ dài nội dung', () => {
  const result = normalizeInterpretation({
    intent: 'SEARCH',
    keyword: 'x'.repeat(120),
    sellerName: '',
    productName: '',
    compareProduct1: '',
    compareProduct2: '',
    availability: 'ANY',
    minPrice: -1,
    maxPrice: '99999999999999',
    reply: 'y'.repeat(1200),
  });

  assert.equal(result.keyword.length, 100);
  assert.equal(result.minPrice, 0);
  assert.equal(result.maxPrice, 1_000_000_000_000);
  assert.equal(result.reply.length, 1000);
});

test('trợ lý Gemini: chuẩn hóa ý định so sánh và thông tin sản phẩm', () => {
  const result = normalizeInterpretation({
    intent: 'COMPARE',
    keyword: '',
    sellerName: '',
    productName: '',
    compareProduct1: 'iPhone 11',
    compareProduct2: 'Samsung A52',
    availability: 'CHECK',
    minPrice: 0,
    maxPrice: 0,
    reply: '',
  });

  assert.equal(result.intent, 'COMPARE');
  assert.equal(result.compareProduct1, 'iPhone 11');
  assert.equal(result.compareProduct2, 'Samsung A52');
  assert.equal(result.availability, 'CHECK');
});

test('trợ lý Gemini: báo lỗi rõ khi API từ chối yêu cầu', async () => {
  await assert.rejects(
    interpretMessage({
      message: 'Tìm laptop',
      apiKey: 'test-key',
      fetchImpl: async () => fakeResponse({
        error: { message: 'API key invalid' },
      }, false, 403),
    }),
    /Gemini API lỗi \(403\): API key invalid/
  );
});
