'use strict';
if (process.env.D13_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Chỉ DB D13 test local đã guard UUID.');
const assert = require('node:assert/strict');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
const { pngReceipt } = require('../tests/D03_ThanhToan/fixtures');
let f;
(async () => {
  f = await createD13Environment(); const { Orders, Payments, Deliveries, Listings } = f.models;
  const product = await f.listing(), quote = await f.estimate(product), created = await f.createOrder(product, quote.body.data); assert.equal(created.status, 201);
  const id = created.body.data.orderId;
  assert.equal((await f.request(`/api/seller/store/order/${id}/status`, { user: f.seller, method: 'PATCH', body: { status: 'CONFIRM' } })).status, 200);
  const info = await f.request(`/api/v1/orders/${id}/payment-info`, { user: f.buyer }); assert.equal(info.body.data.sellerAmount, '100000.10'); assert.equal(info.body.data.deliveryFee, '20000.20');
  const report = () => f.request(`/api/v1/orders/${id}/payment-notice`, { user: f.buyer, method: 'POST', body: { amount: '100000.10' }, file: { buffer: pngReceipt() } });
  const preview = () => f.request(`/api/v1/seller/orders/${id}/payment`, { user: f.seller });
  const decide = (action, reportVersion) => f.request(`/api/v1/seller/orders/${id}/payment`, { user: f.seller, method: 'PATCH', body: { action, reportVersion } });
  assert.equal((await report()).status, 200); assert.equal((await Orders.findByPk(id)).Status, 'WAITING_PAYMENT');
  assert.equal((await f.request(`/api/v1/orders/${id}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Test' } })).status, 409);
  assert.equal((await Listings.findByPk(product.ListingId)).Status, 'RESERVED');
  const old = (await preview()).body.data.reportVersion; assert.equal((await decide('REJECT', old)).status, 200);
  assert.equal((await report()).status, 200); const fresh = (await preview()).body.data.reportVersion; assert.notEqual(old, fresh);
  const stale = await decide('CONFIRM', old); assert.equal(stale.status, 409); assert.equal(stale.body.code, 'PAYMENT_REPORT_CHANGED');
  assert.equal((await Orders.findByPk(id)).Status, 'WAITING_PAYMENT'); assert.equal((await decide('CONFIRM', fresh)).status, 200);
  assert.equal((await Payments.findOne({ where: { OrderId: id } })).Amount, '100000.10'); assert.equal((await Orders.findByPk(id)).Status, 'PAID'); assert.equal(await Deliveries.count({ where: { OrderId: id } }), 0);
  const cancelled = await f.request(`/api/v1/orders/${id}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Test' } }); assert.equal(cancelled.status, 409); assert.equal((await Listings.findByPk(product.ListingId)).Status, 'RESERVED');
  const raceProduct = await f.listing(), raceQuote = await f.estimate(raceProduct), raceCreated = await f.createOrder(raceProduct, raceQuote.body.data);
  const raceId = raceCreated.body.data.orderId;
  assert.equal((await f.request(`/api/seller/store/order/${raceId}/status`, { user: f.seller, method: 'PATCH', body: { status: 'CONFIRM' } })).status, 200);
  assert.equal((await f.request(`/api/v1/orders/${raceId}/payment-notice`, { user: f.buyer, method: 'POST', body: { amount: '100000.10' }, file: { buffer: pngReceipt() } })).status, 200);
  const raceVersion = (await f.request(`/api/v1/seller/orders/${raceId}/payment`, { user: f.seller })).body.data.reportVersion;
  const [raceCancel, raceConfirm] = await Promise.all([
    f.request(`/api/v1/orders/${raceId}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Concurrent cancel' } }),
    f.request(`/api/v1/seller/orders/${raceId}/payment`, { user: f.seller, method: 'PATCH', body: { action: 'CONFIRM', reportVersion: raceVersion } }),
  ]);
  assert.equal(raceCancel.status, 409); assert.equal(raceConfirm.status, 200);
  assert.equal((await Orders.findByPk(raceId)).Status, 'PAID'); assert.equal((await Listings.findByPk(raceProduct.ListingId)).Status, 'RESERVED');
  assert.equal(await f.models.StatusHistories.count({ where: { OrderId: raceId, StatusValue: 'CANCELLED' } }), 0);
  assert.equal(await f.models.StatusHistories.count({ where: { OrderId: raceId, StatusValue: 'PAID' } }), 1);
  console.log(`PASS D02/D04 MySQL race Order#${raceId}: reported payment cancellation=409, seller confirmation=200; PAID once, listing remains RESERVED.`);
  const pickupProduct = await f.listing(), pickup = await f.request('/api/v1/orders', { user: f.buyer, method: 'POST', body: { listingId: pickupProduct.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Buyer', receiverPhone: '0900000111' } }); assert.equal(pickup.status, 201);
  const pickupId = pickup.body.data.orderId; await f.pay(pickupId);
  const preparation = await f.request(`/api/seller/orders/${pickupId}/preparation`, { user: f.seller, method: 'POST', body: {} }); assert.equal(preparation.status, 409);
  const receipt = await f.request(`/api/v1/orders/${pickupId}/received-preview`, { user: f.buyer }); assert.equal(receipt.status, 200); assert.equal(receipt.body.data.policy.code, 'PICKUP_HANDOVER_UNAVAILABLE');
  assert.equal(await Deliveries.count({ where: { OrderId: pickupId } }), 0);
  console.log('PASS D02-D04 actual MySQL: REPORTED blocks cancel/reopen, report-only stays WAITING_PAYMENT, stale D04 report rejected, latest report PAID with product money only; PICKUP no fee/trip. Confirmed dependency: C07 PICKUP handover missing, D06 stays blocked.');
})().catch(e => { console.error('D payment verification failed:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
