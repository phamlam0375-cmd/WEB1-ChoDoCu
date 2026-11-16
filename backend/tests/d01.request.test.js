'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const request = require('../src/services/D01_DatHang_GiuMon/orderRequest');
test('D01 request key UUID, normalized intent hash and collision rejection', () => {
  const key = randomUUID(); assert.equal(request.key(key.toUpperCase()), key); assert.equal(request.key(undefined), null);
  for (const bad of ['', 'same', 123]) assert.throws(() => request.key(bad), { status: 400 });
  assert.notEqual(request.hash({ receiverName: 'A' }), request.hash({ receiverName: 'B' }));
  assert.throws(() => request.replay({ D01RequestHash: 'other' }, 'intent'), { code: 'ORDER_REQUEST_REUSED', status: 409 });
});
test('D01 replay returns current state and exact DECIMAL, never revives a cancelled/completed reservation', () => {
  for (const Status of ['RESERVED', 'CANCELLED', 'COMPLETED']) {
    const result = request.replay({ OrderId: 91, ListingId: 41, Status, DeliveryMethod: 'PICKUP', D01RequestHash: 'intent', ProductAmount: '9999999999999999.99', DeliveryFee: '0.00', TotalAmount: '9999999999999999.99', ReservedUntil: '2026-11-13T01:00:00Z' }, 'intent');
    assert.equal(result.data.status, Status); assert.equal(result.data.alreadyApplied, true); assert.equal(result.data.totalAmountDecimal, '9999999999999999.99');
    assert.equal(result.data.D01RequestHash, undefined);
  }
});
