'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const validator = require('../src/validators/D09_CapNhatTienDoGiaoHang/progress.validator');
const { progressPolicy } = require('../src/services/D09_CapNhatTienDoGiaoHang/progress.policy');
const { createProgressService } = require('../src/services/D09_CapNhatTienDoGiaoHang/progress.service');
const { safeNote } = require('../src/services/D05_TheoDoiDonHang/tracking.service');
const now = new Date('2026-10-26T06:00:00Z');
function state() {
  return { order: { OrderId: 1, SellerId: 2, BuyerId: 3, ProductAmount: '100000', Status: 'PAID', DeliveryMethod: 'DELIVERY' }, refund: null,
    payment: { PayerId: 3, PayeeId: 2, ConfirmedBy: 2, Status: 'CONFIRMED', Amount: '100000', BankName: 'TEST', BankAccountSnapshot: '12345', BankAccountHolderSnapshot: 'TEST', ProofUrl: '/proof.png', TransferContent: 'TEST', ReportedAt: '2026-10-26T05:00:00Z', ConfirmedAt: '2026-10-26T05:00:00Z' },
    delivery: { DeliveryId: 1, DriverId: 4, Status: 'PICKED_UP', PreparedBy: 2, ReadyForPickupAt: '2026-10-26T05:01:00Z', AcceptedAt: '2026-10-26T05:02:00Z',
      SellerHandoverBy: 2, SellerHandoverDriverId: 4, SellerHandoverAt: '2026-10-26T05:03:00Z', PickupCodeIssuedAt: '2026-10-26T05:03:00Z', PickupCodeExpiresAt: '2026-10-26T05:13:00Z',
      PickedUpAt: '2026-10-26T05:04:00Z', PickupCodeUsedAt: '2026-10-26T05:04:00Z', PickupCodeHash: 'fixture-hash-not-code' } };
}
const driver = () => ({ profile: { AvailabilityStatus: 'BUSY' }, active: { DeliveryId: 1 } });
test('D09 strict validation, trim 500 Unicode ký tự, action riêng và UUID; chặn mọi đường tắt D13', () => {
  assert.deepEqual(validator.update({ status: 'DELIVERING', note: '  thử  ' }, randomUUID()).note, 'thử');
  validator.update({ status: 'DELIVERING', note: '🙂'.repeat(500) }, randomUUID());
  for (const body of [{}, { status: 'FAILED' }, { status: 'DELIVERED' }, { status: 'DELIVERING', note: 1 }, { status: 'DELIVERING', note: 'x'.repeat(501) },
    { status: 'DELIVERING', action: 'NOTE', note: ' ' }, { status: 'DELIVERING', action: 'COMPLETE' }]) assert.throws(() => validator.update(body, randomUUID()), { status: 400 });
  for (const key of ['DriverId', 'UserId', 'verified', 'VerifiedAt', 'DeliveredAt', 'ProofUrl', 'CompletionCodeHash', 'CompletedAt', 'pickupCode']) assert.throws(() => validator.update({ status: 'DELIVERING', [key]: true }, randomUUID()), { status: 400 });
  assert.throws(() => validator.update({ status: 'DELIVERING' }, 'bad-key'), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
  for (const id of ['0', '-1', '1x', '4294967296']) assert.throws(() => validator.id(id));
});
test('D09 policy yêu cầu dấu D08 hợp lệ, BUSY và PAID -> IN_DELIVERY, không dùng AVAILABLE hoặc nhánh D10', () => {
  assert.equal(progressPolicy(state(), driver(), now).allowed, true);
  const delivering = state(); delivering.delivery.Status = 'DELIVERING'; delivering.order.Status = 'IN_DELIVERY';
  assert.equal(progressPolicy(delivering, driver(), now).allowed, true);
  for (const modify of [s => { s.order.Status = 'CANCELLED'; }, s => { s.order.DeliveryMethod = 'PICKUP'; }, s => { s.refund = {}; }, s => { s.order.CompletedAt = now; },
    s => { s.payment.Amount = '1'; }, s => { s.payment.Status = 'REPORTED'; }, s => { s.delivery.PickedUpAt = null; }, s => { s.delivery.PickupCodeUsedAt = null; },
    s => { s.delivery.PickupProofKey = 'other'; }, s => { s.delivery.SellerHandoverDriverId = 8; }, s => { s.delivery.PreparedBy = 3; }, s => { s.delivery.PickupCodeExpiresAt = s.delivery.PickedUpAt; },
    ...['AVAILABLE', 'ACCEPTED', 'DELIVERED', 'FAILED', 'RETURNING', 'RETURNED'].map(status => s => { s.delivery.Status = status; })]) {
    const s = state(); modify(s); assert.equal(progressPolicy(s, driver(), now).allowed, false);
  }
  for (const availability of ['AVAILABLE', 'OFFLINE']) { const d = driver(); d.profile.AvailabilityStatus = availability; assert.equal(progressPolicy(state(), d, now).allowed, false); }
  assert.equal(progressPolicy(state(), { ...driver(), active: { DeliveryId: 2 } }, now).allowed, false);
});
test('D09 từ chối danh tính demo; ánh xạ schema/lock trước khi lỗi tới API', async () => {
  await assert.rejects(createProgressService().update(1, {}, randomUUID(), { UserId: 4, d01Demo: true }), { status: 401 });
  for (const [code, status] of [['ER_BAD_FIELD_ERROR', 503], ['ER_LOCK_DEADLOCK', 409], ['ER_LOCK_WAIT_TIMEOUT', 409]]) {
    const service = createProgressService({ repository: { locate: async () => ({ OrderId: 1 }), withTransaction: async () => { throw { original: { code } }; } } });
    await assert.rejects(service.update(1, { status: 'DELIVERING' }, randomUUID(), { UserId: 4 }), { status });
  }
});
test('D09 ghi chú D04 thông thường không bị parser metadata thanh toán làm mất; vẫn che nội dung nhạy cảm', () => {
  assert.equal(safeNote({ StatusType: 'DELIVERY', Note: 'D04 đã xác nhận, đang giao' }, true), 'D04 đã xác nhận, đang giao');
  assert.equal(safeNote({ StatusType: 'DELIVERY', Note: '<b>Đang giao</b>' }, false), '<b>Đang giao</b>');
  assert.equal(safeNote({ StatusType: 'DELIVERY', Note: 'Bearer private-session' }, true), 'Đã ẩn nội dung bảo mật.');
});
