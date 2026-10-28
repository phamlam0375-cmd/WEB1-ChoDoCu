'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stubModule, stubModels, fakeRow, fakeResponse } = require('./helpers/bStubs');

const auditCalls = [];
const notifyCalls = [];
stubModule('services/settings.service.js', { getSetting: async () => 0, getSettingAt: async () => 0, getSettingsMap: async () => ({}) });
stubModule('services/auditLog.service.js', { logAdminAction: async (req, entry) => auditCalls.push(entry) });
stubModule('services/notification.service.js', { notify: async (userId, entry) => notifyCalls.push({ userId, ...entry }) });
stubModule('services/commissionReminder.service.js', { remindOverdueCommissions: async () => 0, remindInBackground: () => {} });

const db = { rows: new Map(), findAllWhere: null };
stubModels({
  Commissions: {
    findAll: async ({ where }) => {
      db.findAllWhere = where;
      return [...db.rows.values()].filter((row) => where.CommissionId.includes(row.CommissionId) && row.SellerId === where.SellerId);
    },
    findByPk: async (id) => db.rows.get(Number(id)) || null,
  },
});

const { reportFeePayment, reviewFeePayment, bulkReviewFeePayments } = require('../src/controllers/commissions.controller');

function fee(id, overrides = {}) {
  return fakeRow({
    CommissionId: id,
    OrderId: id + 100,
    SellerId: 7,
    AmountDue: '50000.00',
    AdjustmentAmount: '0.00',
    Status: 'UNPAID',
    PaymentReference: `HH${String(id + 100).padStart(6, '0')}`,
    PaymentTransactionCode: null,
    PaymentProofUrl: null,
    ReportedAt: null,
    DueAt: new Date('2099-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

function seed(...rows) {
  db.rows.clear();
  rows.forEach((row) => db.rows.set(row.CommissionId, row));
}

const seller = { UserId: 7 };
const admin = { UserId: 1 };

test.beforeEach(() => {
  auditCalls.length = 0;
  notifyCalls.length = 0;
  db.findAllWhere = null;
  seed();
});

// ---- Người bán báo đã nộp phí ----

test('B09: báo nộp phải chọn ít nhất 1 khoản và tối đa 50 khoản', async () => {
  const res = fakeResponse();
  const base = { user: seller, body: { transactionCode: 'FT1', amount: 50000 } };
  await assert.rejects(reportFeePayment({ ...base, body: { ...base.body, commissionIds: [] } }, res), { status: 400 });
  const tooMany = Array.from({ length: 51 }, (_, i) => i + 1);
  await assert.rejects(reportFeePayment({ ...base, body: { ...base.body, commissionIds: tooMany } }, res), {
    status: 400,
    message: 'Mỗi lần báo nộp tối đa 50 khoản',
  });
});

test('B09: báo nộp phải có mã giao dịch', async () => {
  seed(fee(1));
  await assert.rejects(reportFeePayment({ user: seller, body: { commissionIds: [1], amount: 50000 } }, fakeResponse()), { status: 400 });
});

test('B09: số tiền báo nộp phải khớp tổng các khoản chọn, lệch dù 1 đồng cũng bị từ chối', async () => {
  seed(fee(1), fee(2, { AmountDue: '30000.00' }));
  const body = { commissionIds: [1, 2], transactionCode: 'FT123' };
  await assert.rejects(reportFeePayment({ user: seller, body: { ...body, amount: 79999 } }, fakeResponse()), {
    status: 400,
    message: 'Số tiền không khớp với khoản phí cần nộp',
  });
  await assert.rejects(reportFeePayment({ user: seller, body: { ...body, amount: 'abc' } }, fakeResponse()), { status: 400 });
  assert.equal(db.rows.get(1).Status, 'UNPAID', 'báo sai tiền thì không đổi trạng thái');
});

test('B09: báo nộp thành công thì các khoản chuyển REPORTED kèm mã giao dịch và giờ báo', async () => {
  seed(fee(1), fee(2, { AmountDue: '30000.00', Status: 'ADJUSTED', AdjustmentAmount: '-20000.00' }));
  const res = fakeResponse();
  await reportFeePayment(
    { user: seller, body: { commissionIds: [1, 2, 2], transactionCode: 'FT123', amount: 80000, proofUrl: 'https://example.com/bill.png' } },
    res
  );
  assert.equal(res.statusCode, 200);
  for (const id of [1, 2]) {
    const row = db.rows.get(id);
    assert.equal(row.Status, 'REPORTED');
    assert.equal(row.PaymentTransactionCode, 'FT123');
    assert.equal(row.PaymentProofUrl, 'https://example.com/bill.png');
    assert.ok(row.ReportedAt instanceof Date);
  }
});

test('B09: người bán chỉ báo nộp được khoản của chính mình', async () => {
  seed(fee(1), fee(2, { SellerId: 99 }));
  await assert.rejects(
    reportFeePayment({ user: seller, body: { commissionIds: [1, 2], transactionCode: 'FT1', amount: 100000 } }, fakeResponse()),
    { status: 404 }
  );
  assert.equal(db.findAllWhere.SellerId, 7, 'truy vấn phải lọc theo người đang đăng nhập');
  assert.equal(db.rows.get(1).Status, 'UNPAID', 'một khoản không hợp lệ thì cả lô không bị đổi');
});

test('B09: khoản đã báo nộp hoặc đã thu thì không báo lại được', async () => {
  for (const status of ['REPORTED', 'PAID', 'WAIVED']) {
    seed(fee(1, { Status: status }));
    await assert.rejects(
      reportFeePayment({ user: seller, body: { commissionIds: [1], transactionCode: 'FT1', amount: 50000 } }, fakeResponse()),
      { status: 409 },
      `trạng thái ${status}`
    );
  }
});

// ---- Admin đối soát ----

test('B09: admin xác nhận đã thu thì khoản chuyển PAID, ghi nhật ký và báo người bán', async () => {
  seed(fee(1, { Status: 'REPORTED' }));
  const res = fakeResponse();
  await reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'CONFIRM' } }, res);
  const row = db.rows.get(1);
  assert.equal(res.statusCode, 200);
  assert.equal(row.Status, 'PAID');
  assert.equal(row.ConfirmedBy, 1);
  assert.ok(row.ConfirmedAt instanceof Date);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'FEE_CONFIRM');
  assert.deepEqual(auditCalls[0].oldValue.Status, 'REPORTED');
  assert.equal(notifyCalls.length, 1);
  assert.equal(notifyCalls[0].userId, 7);
  assert.equal(notifyCalls[0].title, 'Đã xác nhận thu phí');
});

test('B09: từ chối đối soát bắt buộc có lý do, và xoá thông tin báo nộp để người bán nộp lại', async () => {
  seed(fee(1, { Status: 'REPORTED', PaymentTransactionCode: 'FT1', PaymentProofUrl: 'https://example.com/a.png', ReportedAt: new Date() }));
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'REJECT' } }, fakeResponse()), {
    status: 400,
    message: 'Vui lòng nhập lý do',
  });
  assert.equal(db.rows.get(1).Status, 'REPORTED');

  await reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'REJECT', note: 'Không thấy tiền về' } }, fakeResponse());
  const row = db.rows.get(1);
  assert.equal(row.Status, 'UNPAID');
  assert.equal(row.PaymentTransactionCode, null);
  assert.equal(row.PaymentProofUrl, null);
  assert.equal(row.ReportedAt, null);
  assert.equal(auditCalls[0].action, 'FEE_REJECT');
  assert.match(notifyCalls[0].message, /Không thấy tiền về/);
});

test('B09: khoản đã được điều chỉnh khi bị từ chối thì quay về ADJUSTED chứ không phải UNPAID', async () => {
  seed(fee(1, { Status: 'REPORTED', AdjustmentAmount: '-20000.00' }));
  await reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'REJECT', note: 'Sai nội dung' } }, fakeResponse());
  assert.equal(db.rows.get(1).Status, 'ADJUSTED');
});

test('B09: miễn phí bắt buộc có lý do và chuyển khoản sang WAIVED', async () => {
  seed(fee(1));
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'WAIVE' } }, fakeResponse()), { status: 400 });
  await reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'WAIVE', note: 'Đơn lỗi do hệ thống' } }, fakeResponse());
  assert.equal(db.rows.get(1).Status, 'WAIVED');
  assert.equal(auditCalls[0].action, 'FEE_WAIVE');
});

test('B09: không đối soát được khoản ở trạng thái không phù hợp hoặc không tồn tại', async () => {
  seed(fee(1, { Status: 'PAID' }), fee(2, { Status: 'UNPAID' }));
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'CONFIRM' } }, fakeResponse()), { status: 409 });
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '2' }, body: { action: 'REJECT', note: 'x' } }, fakeResponse()), { status: 409 });
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '999' }, body: { action: 'CONFIRM' } }, fakeResponse()), { status: 404 });
  await assert.rejects(reviewFeePayment({ user: admin, params: { id: '1' }, body: { action: 'XOA' } }, fakeResponse()), { status: 400 });
  assert.equal(auditCalls.length, 0, 'thao tác bị từ chối thì không ghi nhật ký');
  assert.equal(notifyCalls.length, 0);
});

test('B09: xác nhận hàng loạt chỉ nhận khoản đang chờ xác nhận, khoản khác được báo lại là lỗi', async () => {
  seed(fee(1, { Status: 'REPORTED' }), fee(2, { Status: 'UNPAID' }), fee(3, { Status: 'REPORTED' }));
  const res = fakeResponse();
  await bulkReviewFeePayments({ user: admin, body: { action: 'CONFIRM', ids: [1, 2, 3, 404] } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.done, [1, 3]);
  assert.deepEqual(res.body.data.failed.map((item) => item.id), [2, 404]);
  assert.equal(db.rows.get(1).Status, 'PAID');
  assert.equal(db.rows.get(2).Status, 'UNPAID', 'khoản chưa báo nộp không bị xác nhận nhầm');
  assert.equal(db.rows.get(3).Status, 'PAID');
  assert.equal(auditCalls.length, 2);
});

test('B09: xác nhận hàng loạt giới hạn 50 khoản và không nhận danh sách rỗng', async () => {
  await assert.rejects(bulkReviewFeePayments({ user: admin, body: { action: 'CONFIRM', ids: [] } }, fakeResponse()), { status: 400 });
  const tooMany = Array.from({ length: 51 }, (_, i) => i + 1);
  await assert.rejects(bulkReviewFeePayments({ user: admin, body: { action: 'CONFIRM', ids: tooMany } }, fakeResponse()), { status: 400 });
});
