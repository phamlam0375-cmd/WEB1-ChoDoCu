'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stubModule, stubModels, fakeRow } = require('./helpers/bStubs');

// Cấu hình giả: mỗi test có thể đổi giá trị trước khi gọi service.
const settings = { COMMISSION_DUE_DAYS: 7, SELLER_DEBT_LIMIT: 200000 };
const settingAtCalls = [];
let settingAtRate = 3;
stubModule('services/settings.service.js', {
  getSetting: async (key) => settings[key],
  getSettingAt: async (key, at) => {
    settingAtCalls.push([key, at]);
    return settingAtRate;
  },
  getSettingsMap: async () => ({}),
});

const state = { orders: new Map(), commissionByOrder: new Map(), created: [], findAllRows: [], overdueCount: 0, createError: null };
stubModels({
  Orders: { findByPk: async (id) => state.orders.get(id) || null },
  Commissions: {
    findOne: async ({ where }) => state.commissionByOrder.get(where.OrderId) || null,
    create: async (data) => {
      if (state.createError) throw state.createError;
      state.created.push(data);
      return fakeRow({ CommissionId: state.created.length, ...data });
    },
    findAll: async () => state.findAllRows,
    count: async () => state.overdueCount,
  },
});

const {
  paymentReference,
  createCommissionForOrder,
  getSellerDebt,
  isSellerOverDebtLimit,
} = require('../src/services/commission.service');

const completedAt = new Date('2026-10-10T00:00:00.000Z');
function order(overrides = {}) {
  return {
    OrderId: 7,
    SellerId: 2,
    Status: 'COMPLETED',
    ProductAmount: '1000000.00',
    CommissionRate: '5.00',
    CreatedAt: new Date('2026-10-01T00:00:00.000Z'),
    CompletedAt: completedAt,
    ...overrides,
  };
}

test.beforeEach(() => {
  state.orders.clear();
  state.commissionByOrder.clear();
  state.created.length = 0;
  state.findAllRows = [];
  state.overdueCount = 0;
  state.createError = null;
  settingAtCalls.length = 0;
  settingAtRate = 3;
});

test('B08: mã nội dung chuyển khoản có dạng HH + mã đơn đủ 6 chữ số', () => {
  assert.equal(paymentReference(7), 'HH000007');
  assert.equal(paymentReference(123456), 'HH123456');
});

test('B08: hoa hồng = giá sản phẩm x tỷ lệ đã chốt trên đơn, hạn nộp = ngày hoàn tất + số ngày cấu hình', async () => {
  state.orders.set(7, order());
  const { commission, created } = await createCommissionForOrder(7);
  assert.equal(created, true);
  assert.equal(commission.Rate, 5);
  assert.equal(commission.OriginalAmount, 50000);
  assert.equal(commission.AmountDue, 50000);
  assert.equal(commission.AdjustmentAmount, 0);
  assert.equal(commission.Status, 'UNPAID');
  assert.equal(commission.PaymentReference, 'HH000007');
  assert.equal(commission.SellerId, 2);
  assert.equal(commission.DueAt.toISOString(), '2026-10-17T00:00:00.000Z');
  assert.equal(settingAtCalls.length, 0, 'đơn đã có tỷ lệ thì không tra lại cấu hình');
});

test('B08: số tiền hoa hồng được làm tròn về đồng', async () => {
  state.orders.set(1, order({ OrderId: 1, ProductAmount: '54321.00' })); // 2716,05 -> 2716
  state.orders.set(2, order({ OrderId: 2, ProductAmount: '30.00' })); // 1,5 -> 2
  assert.equal((await createCommissionForOrder(1)).commission.OriginalAmount, 2716);
  assert.equal((await createCommissionForOrder(2)).commission.OriginalAmount, 2);
});

test('B08: đơn cũ chưa lưu tỷ lệ thì lấy cấu hình có hiệu lực lúc đặt đơn', async () => {
  const placedAt = new Date('2026-09-01T00:00:00.000Z');
  state.orders.set(7, order({ CommissionRate: null, CreatedAt: placedAt }));
  const { commission } = await createCommissionForOrder(7);
  assert.deepEqual(settingAtCalls, [['COMMISSION_RATE', placedAt]]);
  assert.equal(commission.Rate, 3);
  assert.equal(commission.OriginalAmount, 30000);
});

test('B08: hoa hồng làm tròn về 0 đồng thì ghi nhận là WAIVED, không bắt người bán nộp', async () => {
  state.orders.set(7, order({ ProductAmount: '5.00' })); // 0,25 -> 0
  const { commission } = await createCommissionForOrder(7);
  assert.equal(commission.OriginalAmount, 0);
  assert.equal(commission.Status, 'WAIVED');
});

test('B08: chỉ tính hoa hồng cho đơn đã hoàn tất; đơn không tồn tại báo 404', async () => {
  state.orders.set(7, order({ Status: 'PAID' }));
  await assert.rejects(createCommissionForOrder(7), { status: 400, message: 'Chỉ tính hoa hồng cho đơn đã hoàn tất' });
  await assert.rejects(createCommissionForOrder(999), { status: 404 });
  assert.equal(state.created.length, 0);
});

test('B08: gọi lại nhiều lần chỉ có MỘT khoản hoa hồng cho mỗi đơn', async () => {
  state.orders.set(7, order());
  const existing = fakeRow({ CommissionId: 99, OrderId: 7, AmountDue: 50000 });
  state.commissionByOrder.set(7, existing);
  const result = await createCommissionForOrder(7);
  assert.equal(result.created, false);
  assert.equal(result.commission, existing);
  assert.equal(state.created.length, 0);
});

test('B08: hai yêu cầu cùng lúc: bên thua đọc lại khoản bên kia vừa tạo, không báo lỗi', async () => {
  state.orders.set(7, order());
  const winner = fakeRow({ CommissionId: 5, OrderId: 7, AmountDue: 50000 });
  state.createError = Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' });
  // Lần tìm đầu chưa thấy; sau khi tạo lỗi trùng thì khoản của bên thắng đã có.
  let lookups = 0;
  const models = require('../src/models');
  models.Commissions.findOne = async () => (++lookups === 1 ? null : winner);
  const result = await createCommissionForOrder(7);
  assert.equal(result.created, false);
  assert.equal(result.commission, winner);
  // Trả lại hàm tìm gốc cho các test sau.
  models.Commissions.findOne = async ({ where }) => state.commissionByOrder.get(where.OrderId) || null;
});

test('B08: lỗi khác lỗi trùng khoá thì được ném ra, không nuốt mất', async () => {
  state.orders.set(7, order());
  state.createError = new Error('mất kết nối');
  await assert.rejects(createCommissionForOrder(7), { message: 'mất kết nối' });
});

test('B08: tổng nợ tách khoản chưa báo nộp (UNPAID + ADJUSTED) và khoản chờ xác nhận (REPORTED)', async () => {
  state.findAllRows = [
    { Status: 'UNPAID', total: '100000', count: 2 },
    { Status: 'ADJUSTED', total: '50000', count: 1 },
    { Status: 'REPORTED', total: '30000', count: 1 },
  ];
  state.overdueCount = 2;
  const debt = await getSellerDebt(2);
  assert.deepEqual(debt, { unpaid: 150000, reported: 30000, outstanding: 180000, overdueCount: 2, debtLimit: 200000, overLimit: false });
});

test('B08: vượt hạn mức nợ khi khoản chưa báo nộp lớn hơn hạn mức; khoản đã báo nộp không bị tính', async () => {
  state.findAllRows = [{ Status: 'UNPAID', total: '200001', count: 1 }];
  assert.equal((await getSellerDebt(2)).overLimit, true);
  assert.equal(await isSellerOverDebtLimit(2), true);

  state.findAllRows = [{ Status: 'UNPAID', total: '200000', count: 1 }];
  assert.equal((await getSellerDebt(2)).overLimit, false, 'đúng bằng hạn mức thì chưa vượt');

  state.findAllRows = [{ Status: 'REPORTED', total: '999999', count: 5 }];
  const debt = await getSellerDebt(2);
  assert.equal(debt.overLimit, false, 'đã báo nộp, chờ admin xác nhận thì không chặn người bán');
  assert.equal(debt.outstanding, 999999);
});

test('B08: người bán không nợ gì thì mọi tổng bằng 0', async () => {
  const debt = await getSellerDebt(2);
  assert.equal(debt.unpaid, 0);
  assert.equal(debt.reported, 0);
  assert.equal(debt.outstanding, 0);
  assert.equal(debt.overLimit, false);
});
