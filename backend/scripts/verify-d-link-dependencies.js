'use strict';
// Diagnostic điểm nối ngoài D: chỉ fixture DB test có guard trong helper.
const assert = require('node:assert/strict');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
let f;
(async () => {
  f = await createD13Environment();
  const { Orders, Listings } = f.models, product = await f.listing();
  const body = { listingId: product.ListingId, deliveryMethod: 'PICKUP', receiverName: 'Buyer', receiverPhone: '0900000111' };
  const first = await f.request('/api/v1/orders', { user: f.buyer, method: 'POST', body }); assert.equal(first.status, 201);
  const id = first.body.data.orderId;
  // Điều khiển thứ tự request để tái hiện tab người bán cũ; không gán trạng thái DB.
  let resume, entered;
  const pause = new Promise(resolve => { resume = resolve; }), ready = new Promise(resolve => { entered = resolve; });
  const hook = `d_link_${id}`;
  Orders.addHook('beforeUpdate', hook, async order => {
    if (Number(order.OrderId) === id && order.Status === 'WAITING_PAYMENT') { entered(); await pause; }
  });
  let accepting;
  try {
    accepting = f.request(`/api/seller/store/order/${id}/status`, { user: f.seller, method: 'PATCH', body: { status: 'CONFIRM' } });
    let timeout;
    try { await Promise.race([ready, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('C05 read/update gate timeout')), 5000); })]); }
    finally { clearTimeout(timeout); }
    assert.equal((await f.request(`/api/v1/orders/${id}/cancel`, { user: f.buyer, method: 'PATCH', body: { reason: 'Local race diagnostic' } })).status, 200);
    assert.equal((await Listings.findByPk(product.ListingId)).Status, 'ACTIVE');
    const replacement = await f.request('/api/v1/orders', { user: f.outsider, method: 'POST', body }); assert.equal(replacement.status, 201);
    resume();
    const accepted = await accepting, old = await Orders.findByPk(id), next = await Orders.findByPk(replacement.body.data.orderId);
    if (old.Status === 'WAITING_PAYMENT' && next.Status === 'RESERVED') {
      console.log(`BLOCKED external C05 stale acceptance: Listing#${product.ListingId} cancelled Order#${id} revived after new Order#${next.OrderId}; HTTP=${accepted.status}; two active orders. File: src/controllers/sellerOrder.controller.js (read outside transaction, update without status predicate/lock). No A/B/C edit.`);
      process.exitCode = 2;
    } else {
      assert.notEqual(old.Status, 'WAITING_PAYMENT');
      console.log('PASS C05 stale seller request did not revive cancelled order.');
    }
  } finally { resume(); Orders.removeHook('beforeUpdate', hook); if (accepting) await accepting; }
})().catch(e => { console.error('D link dependency diagnostic:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
