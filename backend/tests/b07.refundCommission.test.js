'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stubModule, stubModels, fakeRow } = require('./helpers/bStubs');

stubModule('services/settings.service.js', { getSetting: async () => 0, getSettingAt: async () => 0, getSettingsMap: async () => ({}) });

let currentCommission = null;
stubModels({ Commissions: { findOne: async () => currentCommission } });

const { adjustCommissionForRefund } = require('../src/services/commission.service');

const transaction = { LOCK: { UPDATE: 'UPDATE' } };
const order = { OrderId: 7, ProductAmount: '1000000.00' };

// Khoản hoa hồng 50.000đ (5% của đơn 1.000.000đ).
function commission(overrides = {}) {
  return fakeRow({
    CommissionId: 1,
    OrderId: 7,
    OriginalAmount: '50000.00',
    AdjustmentAmount: '0.00',
    AmountDue: '50000.00',
    Status: 'UNPAID',
    ...overrides,
  });
}

test('B07: đơn chưa có hoa hồng thì hoàn tiền không đổi gì', async () => {
  currentCommission = null;
  assert.deepEqual(await adjustCommissionForRefund(order, 1000000, { transaction }), { commission: null, changed: false });
});

test('B07: hoàn toàn bộ tiền hàng thì hoa hồng về 0 và chuyển WAIVED', async () => {
  currentCommission = commission();
  const result = await adjustCommissionForRefund(order, 1000000, { transaction });
  assert.equal(result.changed, true);
  assert.equal(currentCommission.AdjustmentAmount, -50000);
  assert.equal(currentCommission.AmountDue, 0);
  assert.equal(currentCommission.Status, 'WAIVED');
  assert.deepEqual(result.before, { Status: 'UNPAID', AdjustmentAmount: 0, AmountDue: 50000 });
});

test('B07: hoàn một phần thì hoa hồng giảm theo đúng tỷ lệ tiền hoàn / giá sản phẩm', async () => {
  currentCommission = commission();
  await adjustCommissionForRefund(order, 400000, { transaction }); // 40% x 50.000 = 20.000
  assert.equal(currentCommission.AdjustmentAmount, -20000);
  assert.equal(currentCommission.AmountDue, 30000);
  assert.equal(currentCommission.Status, 'ADJUSTED');
});

test('B07: hoàn tiền nhiều lần thì phần giảm cộng dồn', async () => {
  currentCommission = commission({ AdjustmentAmount: '-20000.00', AmountDue: '30000.00', Status: 'ADJUSTED' });
  await adjustCommissionForRefund(order, 400000, { transaction }); // giảm thêm 20.000
  assert.equal(currentCommission.AdjustmentAmount, -40000);
  assert.equal(currentCommission.AmountDue, 10000);
  assert.equal(currentCommission.Status, 'ADJUSTED');
});

test('B07: tiền hoàn lớn hơn giá sản phẩm vẫn chỉ giảm tối đa bằng hoa hồng gốc', async () => {
  currentCommission = commission();
  await adjustCommissionForRefund(order, 5000000, { transaction });
  assert.equal(currentCommission.AdjustmentAmount, -50000);
  assert.equal(currentCommission.AmountDue, 0);
});

test('B07: số phải nộp không bao giờ âm dù hoàn tiền thêm khi đã về 0', async () => {
  currentCommission = commission({ AdjustmentAmount: '-50000.00', AmountDue: '0.00', Status: 'ADJUSTED' });
  await adjustCommissionForRefund(order, 500000, { transaction });
  assert.equal(currentCommission.AdjustmentAmount, -50000);
  assert.equal(currentCommission.AmountDue, 0);
  assert.equal(currentCommission.Status, 'WAIVED');
});

test('B07: tiền giảm hoa hồng được làm tròn về đồng', async () => {
  currentCommission = commission();
  await adjustCommissionForRefund({ OrderId: 7, ProductAmount: '300000.00' }, 100000, { transaction }); // 1/3 x 50.000 = 16.666,67
  assert.equal(currentCommission.AdjustmentAmount, -16667);
  assert.equal(currentCommission.AmountDue, 33333);
});

test('B07: khoản đã thu (PAID) hoặc đã miễn (WAIVED) không tự sửa, chỉ để lại ghi chú đối soát tay', async () => {
  for (const status of ['PAID', 'WAIVED']) {
    currentCommission = commission({ Status: status });
    const result = await adjustCommissionForRefund(order, 1000000, { transaction });
    assert.equal(result.changed, false);
    assert.match(result.note, new RegExp(`đã ở trạng thái ${status}`));
    assert.match(result.note, /#7/);
    assert.equal(currentCommission.updates.length, 0, 'không được ghi gì vào khoản đã chốt');
    assert.equal(currentCommission.AmountDue, '50000.00');
  }
});

test('B07: đơn có giá sản phẩm 0 không gây chia cho 0', async () => {
  currentCommission = commission({ OriginalAmount: '0.00', AmountDue: '0.00' });
  await adjustCommissionForRefund({ OrderId: 7, ProductAmount: 0 }, 0, { transaction });
  assert.equal(currentCommission.AmountDue, 0);
  assert.ok(Number.isFinite(currentCommission.AdjustmentAmount));
});
