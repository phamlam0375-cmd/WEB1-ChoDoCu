'use strict';
if (process.env.D13_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Chỉ DB D13 test local với UUID đã guard.');
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
let f;
(async () => {
  f = await createD13Environment(); const { Orders, StatusHistories, Notifications, Deliveries, Listings } = f.models;
  const product = await f.listing({ Price: '9999999999999999.99' });
  const preview = await f.request(`/api/v1/orders/preview/${product.ListingId}`, { user: f.buyer }); assert.equal(preview.status, 200); assert.equal(preview.body.data.listing.priceDecimal, '9999999999999999.99');
  const body = { listingId: product.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Buyer', receiverPhone: '0900000111' }, key = randomUUID();
  const send = (changes = {}, requestId = key, user = f.buyer) => f.request('/api/v1/orders', { method: 'POST', user, body: { ...body, ...changes }, headers: { 'Idempotency-Key': requestId } });
  const responses = await Promise.all([send(), send()]); for (const r of responses) assert.equal(r.status, 201, r.body.message);
  assert.equal(responses[0].body.data.orderId, responses[1].body.data.orderId); assert.equal(responses.filter(r => r.body.data.alreadyApplied).length, 1);
  const id = responses[0].body.data.orderId; assert.equal(responses[0].body.data.totalAmountDecimal, '9999999999999999.99');
  assert.equal(await Orders.count({ where: { ListingId: product.ListingId } }), 1); assert.equal(await StatusHistories.count({ where: { OrderId: id } }), 1); assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: id } }), 1); assert.equal(await Deliveries.count({ where: { OrderId: id } }), 0);
  assert.equal((await send({ receiverName: 'Changed' })).status, 409); assert.equal((await send({}, key, f.outsider)).status, 409); assert.equal((await send({}, randomUUID())).status, 409);
  const cancel = await f.request(`/api/v1/orders/${id}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Test cancellation' } }); assert.equal(cancel.status, 200); assert.equal((await Listings.findByPk(product.ListingId)).Status, 'ACTIVE');
  const retry = await send(); assert.equal(retry.status, 201); assert.equal(retry.body.data.status, 'CANCELLED'); assert.equal(await Orders.count({ where: { ListingId: product.ListingId } }), 1);
  const expire = await f.listing(), next = await send({ listingId: expire.ListingId }, randomUUID()); assert.equal(next.status, 201);
  await Orders.update({ ReservedUntil: new Date(Date.now() - 1000) }, { where: { OrderId: next.body.data.orderId } });
  await require('../src/services/order.service').expireReservations(); assert.equal((await Orders.findByPk(next.body.data.orderId)).Status, 'CANCELLED'); assert.equal((await Listings.findByPk(expire.ListingId)).Status, 'ACTIVE');
  for (const prefixes of [['/api/orders','/api/orders'],['/api/v1/orders','/api/v1/orders'],['/api/orders','/api/v1/orders']]) {
    const contested = await f.listing(), payload = { ...body, listingId: contested.ListingId };
    const results = await Promise.all(prefixes.map((prefix, i) => f.request(prefix, { user: i ? f.outsider : f.buyer, method: 'POST', body: payload, headers: { 'Idempotency-Key': randomUUID() } })));
    assert.deepEqual(results.map(r => r.status).sort(), [201,409]); assert.equal(await Orders.count({ where: { ListingId: contested.ListingId } }), 1);
  }
  const alternatives = await Promise.all([f.listing(), f.listing()]), sharedKey = randomUUID();
  const intents = await Promise.all(alternatives.map(listing => send({ listingId: listing.ListingId }, sharedKey)));
  assert.deepEqual(intents.map(r => r.status).sort(), [201,409]);
  assert.equal(await Orders.count({ where: { BuyerId: f.buyer.UserId, D01RequestId: sharedKey } }), 1);
  const states = await Promise.all(alternatives.map(listing => Listings.findByPk(listing.ListingId)));
  assert.deepEqual(states.map(row => row.Status).sort(), ['ACTIVE','RESERVED']);
  console.log('PASS D01: same buyer/key with different listings concurrently gives one201/one409 and rolls back the losing reservation.');
  console.log('PASS D01 local/test: parallel same-key single order/history/notify; two buyers race through both prefixes gives one201/one409; large DECIMAL exact, different intent/user rejected, cancellation/expiry release correctly, replay never revives state.');
})().catch(e => { console.error('D01 request verification failed:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
