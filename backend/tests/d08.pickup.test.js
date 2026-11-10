'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/validators/D08_XacNhanLayHang/pickup.validator');
const { businessPolicy, codePolicy, createPickupService } = require('../src/services/D08_XacNhanLayHang/pickup.service');
const now = new Date('2026-10-26T05:00:00Z');
function state() {
  return { order: { OrderId: 1, SellerId: 2, BuyerId: 3, DeliveryMethod: 'DELIVERY', Status: 'PAID', ProductAmount: '12345.67', CompletedAt: null },
    payment: { PayerId: 3, PayeeId: 2, ConfirmedBy: 2, Amount: '12345.67', Status: 'CONFIRMED', ReportedAt: '2026-10-26T04:00:00Z', ConfirmedAt: '2026-10-26T04:01:00Z',
      ProofUrl: '/proof.png', TransferContent: 'fixture', BankName: 'fixture', BankAccountSnapshot: '123456', BankAccountHolderSnapshot: 'fixture' },
    delivery: { DeliveryId: 1, DriverId: 4, Status: 'ACCEPTED', AcceptedAt: '2026-10-26T04:20:00Z', ReadyForPickupAt: '2026-10-26T04:10:00Z', PreparedBy: 2,
      SellerHandoverBy: 2, SellerHandoverDriverId: 4, SellerHandoverAt: '2026-10-26T04:25:00Z', PickupCodeHash: 'fixture-hash-not-code',
      PickupCodeIssuedAt: '2026-10-26T04:59:00Z', PickupCodeExpiresAt: '2026-10-26T05:09:00Z', PickupCodeAttempts: 0 }, refund: null };
}
test('D08 validator: giữ số 0 đầu, strict checkbox/body và cấm ID/status/URL client', () => {
  assert.ok(v.pickup({ pickupCode: '000042', packageIntact: true }).pickupCode.length === 6);
  for (const body of [{}, { pickupCode: 42, packageIntact: true }, { pickupCode: '000042', packageIntact: 'true' }, { pickupCode: '000042', packageIntact: false }]) assert.throws(() => v.pickup(body), { status: 400 });
  for (const key of ['DriverId', 'UserId', 'Status', 'PickedUpAt', 'proofUrl', 'PickupProofKey']) assert.throws(() => v.pickup({ pickupCode: '000042', packageIntact: true, [key]: 'fake' }), { status: 400 });
  for (const body of [{}, { handoverConfirmed: 'true' }, { handoverConfirmed: true, pickupCode: '000042' }]) assert.throws(() => v.issue(body), { status: 400 });
  v.issue({ handoverConfirmed: true });
  assert.equal(v.image(null), null);
  assert.throws(() => v.image({ buffer: Buffer.from('not-image') }), { status: 400 });
});
test('D08 policy chỉ lấy ACCEPTED/DELIVERY/PAID, đúng D04/C07 và không ghi đè bằng chứng', () => {
  assert.equal(businessPolicy(state(), now).allowed, true);
  for (const modify of [s => { s.order.Status = 'CANCELLED'; }, s => { s.order.DeliveryMethod = 'PICKUP'; }, s => { s.refund = { Status: 'PENDING' }; },
    s => { s.payment.Status = 'REPORTED'; }, s => { s.payment.Amount = '1'; }, s => { s.payment.PayerId = 2; },
    s => { s.delivery.Status = 'PICKED_UP'; }, s => { s.delivery.AcceptedAt = null; }, s => { s.delivery.PreparedBy = 3; },
    s => { s.delivery.ReadyForPickupAt = null; }, s => { s.delivery.PickupProofKey = 'existing'; }]) {
    const s = state(); modify(s); assert.equal(businessPolicy(s, now).allowed, false);
  }
});
test('D08 code policy: đúng seller/driver, hiệu lực và giới hạn; không dùng trạng thái AVAILABLE của D07', () => {
  assert.equal(codePolicy(state(), now).allowed, true);
  for (const modify of [s => { s.delivery.SellerHandoverBy = 3; }, s => { s.delivery.SellerHandoverDriverId = 5; },
    s => { s.delivery.PickupCodeHash = null; }, s => { s.delivery.PickupCodeExpiresAt = now; }, s => { s.delivery.PickupCodeUsedAt = now; }, s => { s.delivery.PickupCodeAttempts = 5; }]) {
    const s = state(); modify(s); assert.equal(codePolicy(s, now).allowed, false);
  }
});
test('D08 schema/lock errors được ánh xạ, không log code và không mở auth demo', async () => {
  for (const [dbCode, status] of [['ER_LOCK_DEADLOCK', 409], ['ER_LOCK_WAIT_TIMEOUT', 409], ['ER_BAD_FIELD_ERROR', 503]]) {
    const service = createPickupService({ repository: { withSnapshot: async () => { throw { original: { code: dbCode } }; } } });
    await assert.rejects(service.getSellerPreview(1, { UserId: 2 }), { status });
  }
  await assert.rejects(createPickupService().getSellerPreview(1, { UserId: 2, d01Demo: true }), { status: 401 });
});
