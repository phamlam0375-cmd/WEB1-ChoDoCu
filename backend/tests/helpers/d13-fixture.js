'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createD12Environment } = require('./d12-fixture');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
async function createD13Environment(options) {
  const f = await createD12Environment(options);
  async function ready({ start = true } = {}) {
    const product = await f.listing(), quote = await f.estimate(product); assert.equal(quote.status, 200);
    const created = await f.createOrder(product, quote.body.data); assert.equal(created.status, 201);
    const orderId = created.body.data.orderId; await f.pay(orderId);
    const prepared = await f.request(`/api/seller/orders/${orderId}/preparation`, { user: f.seller, method: 'POST', body: {} }); assert.equal(prepared.status, 201);
    const deliveryId = prepared.body.data.DeliveryId, driver = await f.driver();
    const t = { order: await f.models.Orders.findByPk(orderId), deliveryId, driver, product };
    assert.equal((await f.request(`/api/v1/driver/deliveries/${deliveryId}/accept`, { user: driver, method: 'PATCH', body: {} })).status, 200);
    const issued = await f.issue(t); assert.equal(issued.status, 200);
    assert.equal((await f.pickup(t, issued.body.data.pickupCode, { file: { buffer: pngReceipt() } })).status, 200);
    if (start) {
      const r = await f.request(`/api/v1/driver/deliveries/${deliveryId}/status`, { user: driver, method: 'PATCH', body: { status: 'DELIVERING', action: 'START', note: 'Test start' }, headers: { 'Idempotency-Key': randomUUID() } }); assert.equal(r.status, 200);
    }
    return { ...t, pickupCode: issued.body.data.pickupCode };
  }
  const issueDelivery = t => f.request(`/api/v1/orders/${t.order.OrderId}/delivery-code`, { user: f.buyer, method: 'POST', body: {} });
  const driverPreview = t => f.request(`/api/v1/driver/deliveries/${t.deliveryId}/complete-preview`, { user: t.driver });
  const submit = (t, body, options = {}) => f.request(`/api/v1/driver/deliveries/${t.deliveryId}/complete`, { user: t.driver, method: 'PATCH', file: { buffer: pngReceipt() }, body, headers: { 'Idempotency-Key': randomUUID() }, ...options });
  async function intent(t) {
    const issued = await issueDelivery(t); assert.equal(issued.status, 200);
    const preview = await driverPreview(t); assert.equal(preview.status, 200);
    return { completionCode: issued.body.data.completionCode, codeSession: preview.body.data.code.session, handoverConfirmed: true };
  }
  return { ...f, ready, issueDelivery, driverPreview, submit, intent };
}
module.exports = { createD13Environment };
