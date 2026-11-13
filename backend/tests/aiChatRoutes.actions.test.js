'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const { ConditionOptions, Listings } = require('../src/models');
const chatRoutes = require('../src/routes/aiChatRoutes');

const app = express();
app.use(express.json());
app.use('/', chatRoutes);

const conditionOptions = [
  {
    ConditionCode: 'GOOD',
    Label: 'Đã qua sử dụng - tốt',
    Description: 'Có dấu hiệu sử dụng nhẹ, hoạt động bình thường.',
  },
  {
    ConditionCode: 'FAIR',
    Label: 'Đã qua sử dụng - khá',
    Description: 'Trầy xước hoặc hao mòn thấy rõ, vẫn dùng được.',
  },
];

async function postChat(message, listings) {
  const originalFindListings = Listings.findAll;
  const originalFindConditions = ConditionOptions.findAll;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  Listings.findAll = async options => {
    let rows = [...listings];
    const statusFilter = options.where.Status;
    if (statusFilter) {
      const statuses = Object.getOwnPropertySymbols(statusFilter)
        .map(symbol => statusFilter[symbol])
        .find(Array.isArray);
      if (statuses) rows = rows.filter(row => statuses.includes(row.Status));
    }

    const [field, direction] = options.order[0];
    if (field === 'Price') {
      rows.sort((a, b) =>
        (Number(a.Price) - Number(b.Price)) *
        (direction === 'DESC' ? -1 : 1)
      );
    }

    const offset = options.offset || 0;
    const limit = options.limit || rows.length;
    return rows.slice(offset, offset + limit);
  };
  ConditionOptions.findAll = async options =>
    conditionOptions.filter(option =>
      options.where.ConditionCode[Object.getOwnPropertySymbols(
        options.where.ConditionCode
      )[0]].includes(option.ConditionCode)
    );

  try {
    return await supertest(app)
      .post('/chat')
      .send({ message });
  } finally {
    Listings.findAll = originalFindListings;
    ConditionOptions.findAll = originalFindConditions;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
}

function listing(ListingId, Title, Price, Status = 'ACTIVE') {
  return {
    ListingId,
    SellerId: 7,
    Title,
    Description: 'Sản phẩm còn sử dụng bình thường.',
    KnownDefects: '',
    Price,
    ConditionLevel: 'GOOD',
    Status,
  };
}

test('trợ lý tìm đúng món rẻ nhất kể cả khi nằm sau trang đầu', async () => {
  const listings = Array.from({ length: 500 }, (_, index) =>
    listing(index + 1, `Sản phẩm khác ${index + 1}`, index + 1)
  );
  listings.push(listing(501, 'iPhone 11 64GB', 1000));

  const response = await postChat('Điện thoại rẻ nhất', listings);

  assert.equal(response.status, 200);
  assert.match(response.body.reply, /iPhone 11 64GB/);
  assert.equal(response.body.products[0].id, 501);
});

test('trợ lý tìm món đắt nhất theo giá tin đăng', async () => {
  const response = await postChat(
    'Sản phẩm đắt nhất',
    [
      listing(1, 'Tai nghe', 250000),
      listing(2, 'Laptop', 15000000),
      listing(3, 'Điện thoại', 5000000),
    ]
  );

  assert.equal(response.status, 200);
  assert.match(response.body.reply, /Laptop/);
  assert.match(response.body.reply, /15\.000\.000đ/);
});

test('trợ lý so sánh giá, tình trạng và trạng thái từ hai tin đăng thật', async () => {
  const samsung = listing(2, 'Samsung A52', 2500000, 'RESERVED');
  samsung.ConditionLevel = 'FAIR';
  const response = await postChat(
    'So sánh iPhone 11 với Samsung A52',
    [
      listing(1, 'iPhone 11 64GB', 2000000, 'ACTIVE'),
      samsung,
    ]
  );

  assert.equal(response.status, 200);
  assert.match(response.body.reply, /rẻ hơn/);
  assert.match(response.body.reply, /Đã qua sử dụng - tốt/);
  assert.match(response.body.reply, /Đã qua sử dụng - khá/);
  assert.match(response.body.reply, /Đang có người đặt/);
  assert.equal(response.body.products.length, 2);
});

test('trợ lý trả tình trạng và lỗi do người bán khai báo, không tự xác nhận chất lượng', async () => {
  const phone = listing(1, 'iPhone 11 64GB', 3000000);
  phone.KnownDefects = 'Pin chai, cần thay pin.';
  const response = await postChat(
    'iPhone 11 còn xài tốt không?',
    [phone]
  );

  assert.equal(response.status, 200);
  assert.match(response.body.reply, /Tình trạng người bán khai báo/);
  assert.match(response.body.reply, /Pin chai, cần thay pin/);
  assert.match(response.body.reply, /không thể xác minh tình trạng thực tế của sản phẩm/i);
  assert.doesNotMatch(response.body.reply, /thiết bị/);
});

test('trợ lý trả trạng thái hiện tại khi hỏi một sản phẩm còn hàng không', async () => {
  const response = await postChat(
    'iPhone 11 còn hàng không?',
    [listing(1, 'iPhone 11 64GB', 3000000, 'SOLD')]
  );

  assert.equal(response.status, 200);
  assert.match(response.body.reply, /đã bán và hiện không còn hàng/i);
});
