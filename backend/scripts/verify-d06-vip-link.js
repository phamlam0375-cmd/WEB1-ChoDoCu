'use strict';
// Fixture VIP đã được thanh toán chỉ nằm trong DB test riêng, không mua credit thật.
const assert = require('node:assert/strict');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
let f;
(async () => {
  f = await createD13Environment();
  const { Orders, Listings, ListingPromotions, PromotionOrders, UserCredits, CreditTransactions, Commissions, StatusHistories } = f.models;
  const t = await f.ready(), intent = await f.intent(t);
  assert.equal((await f.submit(t, intent)).status, 200);
  const id = t.order.OrderId, now = new Date(), duration = 10080, spent = 1000;
  const paidVipFixture = await PromotionOrders.create({ BuyerId: f.seller.UserId, ListingCount: 1, DurationMinutes: duration, TotalCredit: spent, Status: 'PAID', PaidAt: now });
  const wallet = await UserCredits.create({ UserId: f.seller.UserId, Balance: 20 });
  const promotion = await ListingPromotions.create({ ListingId: t.product.ListingId, SellerId: f.seller.UserId, Status: 'ACTIVE',
    StartsAt: new Date(now.getTime() - 86400000), EndsAt: new Date(now.getTime() + 6 * 86400000 + 123000),
    DurationMinutes: duration, CreditUsed: spent, PromotionOrderId: paidVipFixture.PromotionOrderId });
  const originalEnd = promotion.EndsAt, repo = require('../src/repositories/D06_XacNhanNhanHang/receipt.repository'), originalNotify = repo.notifyUser;
  const confirm = () => f.request(`/api/v1/orders/${id}/received`, { method: 'PATCH', user: f.buyer, body: { received: true } });
  // Lỗi cuối transaction phải thu hồi cả hoàn credit và các ghi nhận D06 trước đó.
  try {
    repo.notifyUser = async () => { throw new Error('D06 acceptance rollback fixture'); };
    assert.equal((await confirm()).status, 500);
  } finally { repo.notifyUser = originalNotify; }
  assert.equal((await Orders.findByPk(id)).Status, 'DELIVERED');
  assert.equal((await Listings.findByPk(t.product.ListingId)).Status, 'RESERVED');
  assert.equal((await wallet.reload()).Balance, 20); assert.equal((await promotion.reload()).Status, 'ACTIVE');
  const creditWhere = { PromotionOrderId: paidVipFixture.PromotionOrderId, Type: 'REFUND' };
  assert.equal(await CreditTransactions.count({ where: creditWhere }), 0);
  assert.equal(await Commissions.count({ where: { OrderId: id } }), 0);
  assert.equal(await StatusHistories.count({ where: { OrderId: id, StatusValue: 'COMPLETED' } }), 0);
  const responses = await Promise.all([confirm(), confirm()]);
  for (const r of responses) assert.equal(r.status, 200);
  assert.equal(responses.filter(r => r.body.data.alreadyCompleted).length, 1);
  const completed = await Orders.findByPk(id);
  const remaining = Math.max(0, Math.ceil((new Date(originalEnd).getTime() - new Date(completed.CompletedAt).getTime()) / 60000));
  const expected = Math.floor(spent * remaining / duration);
  assert.ok(expected > 0); assert.equal((await wallet.reload()).Balance, 20 + expected);
  assert.equal((await promotion.reload()).Status, 'REFUNDED');
  assert.equal(await CreditTransactions.count({ where: creditWhere }), 1);
  assert.equal(await Commissions.count({ where: { OrderId: id } }), 1);
  assert.equal(await StatusHistories.count({ where: { OrderId: id, StatusValue: 'COMPLETED' } }), 1);
  await confirm(); assert.equal((await wallet.reload()).Balance, 20 + expected);
  assert.equal(await CreditTransactions.count({ where: creditWhere }), 1);
  console.log(`PASS D06 VIP MySQL: Order#${id}; failed final side effect rolls back order/listing/commission/credit/history; concurrent/repeated confirm completes once, shared VIP refund formula preserved (${expected} fixture credits).`);
})().catch(e => { console.error('D06 VIP verification:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
