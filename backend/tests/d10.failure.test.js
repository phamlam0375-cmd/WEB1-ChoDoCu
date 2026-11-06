'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const v = require('../src/validators/D10_ThatBai_HoanTra/failure.validator');
const rules = require('../src/services/D10_ThatBai_HoanTra/failure.policy');
const { createFailureService } = require('../src/services/D10_ThatBai_HoanTra/failure.service');
const now = new Date('2026-11-06T06:00:00Z'), version = '"d10-1-0-DELIVERING"';
function state() {
  return { order: { OrderId: 1, SellerId: 2, BuyerId: 3, ProductAmount: '100000', Status: 'IN_DELIVERY', DeliveryMethod: 'DELIVERY' }, refund: null, refunds: [],
    payment: { PayerId: 3, PayeeId: 2, ConfirmedBy: 2, Status: 'CONFIRMED', Amount: '100000', BankName: 'TEST', BankAccountSnapshot: '12345', BankAccountHolderSnapshot: 'TEST', ProofUrl: '/proof.png', TransferContent: 'TEST', ReportedAt: '2026-11-06T05:00:00Z', ConfirmedAt: '2026-11-06T05:00:00Z' },
    delivery: { DeliveryId: 1, DriverId: 4, Status: 'DELIVERING', RetryCount: 0, D10Revision: 0, PreparedBy: 2, ReadyForPickupAt: '2026-11-06T05:01:00Z', AcceptedAt: '2026-11-06T05:02:00Z',
      SellerHandoverBy: 2, SellerHandoverDriverId: 4, SellerHandoverAt: '2026-11-06T05:03:00Z', PickupCodeIssuedAt: '2026-11-06T05:03:00Z', PickupCodeExpiresAt: '2026-11-06T05:13:00Z',
      PickedUpAt: '2026-11-06T05:04:00Z', PickupCodeUsedAt: '2026-11-06T05:04:00Z', PickupCodeHash: 'fixture-hash-not-code' } };
}
const driver = { profile: { AvailabilityStatus: 'BUSY' }, active: { DeliveryId: 1 } };
test('D10 strict payload, reason/Other, recipient+checkbox; no client actor/counter/time/proof', () => {
  const parse = body => v.validate(body, randomUUID(), version, 'failure');
  assert.equal(parse({ action: 'FAIL', reasonCode: 'UNAVAILABLE', note: '  thử  ' }).note, 'thử');
  for (const body of [{}, { action: 'DELIVERED' }, { action: 'FAIL' }, { action: 'FAIL', reasonCode: 'OTHER' }, { action: 'FAIL', reasonCode: 'toString' }, { action: 'FAIL', reasonCode: 'OTHER', note: 'x'.repeat(501) }]) assert.throws(() => parse(body), { status: 400 });
  for (const key of ['DriverId', 'UserId', 'RetryCount', 'FailedCount', 'ReturnedAt', 'VerifiedAt', 'ProofUrl', 'status', 'CompletedAt']) assert.throws(() => parse({ action: 'FAIL', reasonCode: 'UNAVAILABLE', [key]: true }), { status: 400 });
  assert.throws(() => v.validate({ action: 'CONFIRM_RETURN', recipientName: 'Seller', handoverConfirmed: 'true' }, randomUUID(), version, 'return'), { status: 400 });
  assert.throws(() => v.validate({ action: 'CONFIRM_RETURN', handoverConfirmed: true }, randomUUID(), version, 'return'), { status: 400 });
  v.validate({ action: 'CONFIRM_RETURN', recipientName: 'Seller', handoverConfirmed: true }, randomUUID(), version, 'return');
  assert.throws(() => v.validate({ action: 'FAIL', reasonCode: 'OTHER', note: 'ok' }, 'bad', version, 'failure'), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
  assert.throws(() => v.validate({ action: 'FAIL', reasonCode: 'OTHER', note: 'ok' }, randomUUID(), undefined, 'failure'), { code: 'DELIVERY_VERSION_REQUIRED' });
});
test('D10 lịch phải có timezone và ngày thật; không chấp nhận datetime-local mơ hồ hay ngày tự normalize', () => {
  assert.equal(v.dateWithZone('2026-11-06T13:00:00+07:00'), '2026-11-06T06:00:00.000Z');
  for (const value of ['2026-11-06T13:00', '2026-02-30T13:00:00Z', '2026-13-01T13:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T13:00:00+15:00']) assert.throws(() => v.dateWithZone(value), { status: 400 });
});
test('D10 phân biệt giữ kiện và tiền: refund không khóa trả hàng nhưng khóa giao lại', () => {
  const s = state(); s.order.Status = 'REFUND_PENDING'; s.refund = { Status: 'PENDING' }; s.delivery.Status = 'FAILED';
  assert.equal(rules.policy(s, driver, 'START_RETURN', now).allowed, true);
  assert.equal(rules.policy(s, driver, 'SCHEDULE', now).allowed, false);
  s.delivery.Status = 'RETURNING'; assert.equal(rules.policy(s, driver, 'CONFIRM_RETURN', now).allowed, true);
  s.order.Status = 'REFUNDED'; assert.equal(rules.policy(s, driver, 'CONFIRM_RETURN', now).allowed, true);
  for (const status of ['COMPLETED', 'DELIVERED']) { s.order.Status = status; assert.equal(rules.policy(s, driver, 'CONFIRM_RETURN', now).allowed, false); }
});
test('D10 đúng thứ tự, không bỏ D08 và không tự giao lại trước lịch; không áp trần 3 lần', () => {
  const s = state(); assert.equal(rules.policy(s, driver, 'FAIL', now).allowed, true);
  assert.equal(rules.policy(s, driver, 'CONFIRM_RETURN', now).allowed, false);
  for (const status of ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'RETURNED']) { s.delivery.Status = status; assert.equal(rules.policy(s, driver, 'FAIL', now).allowed, false); }
  s.delivery.Status = 'FAILED'; s.delivery.RetryCount = 25; s.delivery.RetryScheduledAt = '2026-11-06T06:01:00Z';
  assert.equal(rules.policy(s, driver, 'RETRY', now).allowed, false);
  s.delivery.RetryScheduledAt = '2026-11-06T05:59:00Z'; assert.equal(rules.policy(s, driver, 'RETRY', now).allowed, true);
  s.delivery.PickupCodeUsedAt = null; assert.equal(rules.policy(s, driver, 'START_RETURN', now).allowed, false);
  const delivered = state(); delivered.delivery.VerifiedAt = now;
  assert.equal(rules.policy(delivered, driver, 'FAIL', now).allowed, false);
});
test('D10 nối B06 đúng buyer, không tạo khoản hoàn giả hoặc đưa link tài xế giả danh buyer', () => {
  const s = state(); s.delivery.Status = 'RETURNING';
  assert.ok(rules.refundHandoff(s, 'BUYER').href.endsWith('?source=delivery-return'));
  assert.equal(rules.refundHandoff(s, 'DRIVER').href, null);
  s.order.Status = 'REFUND_PENDING';
  assert.equal(rules.refundHandoff(s, 'DRIVER').status, 'REFUND_PENDING');
  assert.ok(rules.refundHandoff(s, 'DRIVER').message.includes('hiện có'));
  s.order.Status = 'IN_DELIVERY';
  s.payment.Status = 'REPORTED'; assert.equal(rules.refundHandoff(s, 'BUYER').required, false); assert.equal(rules.refundHandoff(s, 'BUYER').href, null);
});
test('D10 từ chối demo và ánh xạ lỗi schema/deadlock để không lộ SQL', async () => {
  await assert.rejects(createFailureService().getPreview(1, { UserId: 4, d01Demo: true }), { status: 401 });
  for (const [code, status] of [['ER_BAD_FIELD_ERROR', 503], ['ER_LOCK_DEADLOCK', 409], ['ER_LOCK_WAIT_TIMEOUT', 409]]) {
    const service = createFailureService({ repository: { locate: async () => ({ OrderId: 1 }), withSnapshot: async () => { throw { original: { code } }; } } });
    await assert.rejects(service.getPreview(1, { UserId: 4 }), { status });
  }
});
