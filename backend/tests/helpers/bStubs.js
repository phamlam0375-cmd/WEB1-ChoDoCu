'use strict';

// Công cụ dùng chung cho test phần B: thay model và service bằng bản giả để chạy
// logic tiền (hoa hồng, hoàn tiền, đối soát phí) mà không cần MySQL.
// Phải gọi trước khi require service/controller cần kiểm thử.
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'src');

function stubModule(relativeToSrc, exports) {
  const id = require.resolve(path.join(SRC, relativeToSrc));
  require.cache[id] = { id, filename: id, loaded: true, children: [], paths: [], exports };
  return exports;
}

// Model nào test không khai báo thì trả object rỗng để destructuring ở đầu file không lỗi.
function stubModels(models = {}) {
  const base = {
    sequelize: {
      transaction: async (work) => work({ LOCK: { UPDATE: 'UPDATE' } }),
      literal: (sql) => sql,
    },
    ...models,
  };
  return stubModule('models/index.js', new Proxy(base, { get: (target, key) => (key in target ? target[key] : {}) }));
}

// Dòng dữ liệu giả: update() ghi thẳng vào object và nhớ lại các lần gọi.
function fakeRow(data) {
  const row = { ...data, updates: [] };
  Object.defineProperty(row, 'update', {
    enumerable: false,
    value: async (changes) => {
      Object.assign(row, changes);
      row.updates.push(changes);
    },
  });
  Object.defineProperty(row, 'get', {
    enumerable: false,
    value: () => {
      const { updates, ...plain } = row;
      return plain;
    },
  });
  return row;
}

function fakeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

module.exports = { stubModule, stubModels, fakeRow, fakeResponse };
