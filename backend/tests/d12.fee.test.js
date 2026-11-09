'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFeeService, TTL_SECONDS } = require('../src/services/D12_UocTinhPhiGiaoHang/fee.service');
const v = require('../src/validators/D12_UocTinhPhiGiaoHang/fee.validator');
const token = require('../src/services/D12_UocTinhPhiGiaoHang/quote.token');
const NOW = new Date('2026-11-06T05:00:00Z');
const input = { listingId: 1, receiverAddress: 'House 1', deliveryArea: 'B', vehicleType: 'MOTORBIKE' };
const listing = { ListingId: 1, SellerId: 2, StoreId: 3, Status: 'ACTIVE' };
const store = { StoreId: 3, OwnerId: 2, Address: 'House 2', PickupArea: 'A', Status: 'ACTIVE' };
const rule = { RuleId: 7, PickupArea: 'A', DeliveryArea: 'B', VehicleType: 'MOTORBIKE', FeeAmount: '0.10', EstimatedMinutes: null, UpdatedAt: null };
function fixture() {
  const state = { listing: { ...listing }, store: { ...store }, rules: [{ ...rule }], now: NOW };
  const repository = { withTransaction: work => work({ LOCK: { SHARE: 'SHARE' } }), user: async () => ({ Status: 'ACTIVE' }),
    listing: async () => state.listing, pickup: async () => state.store, rules: async () => state.rules };
  const service = createFeeService({ repository, clock: () => state.now });
  const verify = q => service.verifyQuote({ quoteId: q.quoteId, receiverAddress: input.receiverAddress, listing: state.listing, buyerId: 1, transaction: {} });
  return { state, service, verify };
}
test('D12 whitelist, kiểu/độ dài, không nhận pickup/phí client và không đoán khu vực', () => {
  for (const body of [null, [], { ...input, pickupArea: 'CHEAP' }, { ...input, amount: 0 }, { ...input, deliveryArea: '' }, { ...input, vehicleType: 4 }, { ...input, receiverAddress: 'x'.repeat(256) }]) assert.throws(() => v.estimate(body), { status: 422 });
  assert.equal(v.key(' Quận  1 '), v.key('quận 1')); assert.notEqual(v.key('Quận 1'), v.key('Quận 10')); assert.notEqual(v.key('Quan 1'), v.key('Quận 1'));
  for (const FeeAmount of ['-1', '1.001', '10000000000000000.00']) assert.throws(() => v.rule({ ...rule, FeeAmount }), { code: 'DELIVERY_RULE_INVALID' });
  assert.equal(v.rule({ ...rule, FeeAmount: '0' }).amount, '0.00'); assert.equal(v.rule(rule).estimatedMinutes, null);
  for (const EstimatedMinutes of [0, -1, '1.1', 2147483648]) assert.throws(() => v.rule({ ...rule, EstimatedMinutes }), { status: 409 });
});
test('D12 chọn đúng chiều và tuple; không default0/rẻ nhất/findOne khi trùng', async () => {
  const { service, state } = fixture();
  assert.equal((await service.estimate(input, { UserId: 1 })).amount, '0.10');
  for (const change of [{ pickupArea: 'B', deliveryArea: 'A' }, { deliveryArea: 'C' }, { vehicleType: 'TRUCK' }]) {
    const payload = { ...input, ...change }; delete payload.pickupArea;
    if (change.pickupArea) state.store.PickupArea = change.pickupArea;
    await assert.rejects(service.estimate(payload, { UserId: 1 }), { code: 'DELIVERY_ROUTE_UNSUPPORTED' }); state.store.PickupArea = 'A';
  }
  state.rules.push({ ...rule, RuleId: 8, FeeAmount: '0' }); await assert.rejects(service.estimate(input, { UserId: 1 }), { code: 'DELIVERY_RULE_CONFLICT' });
});
test('D12 token riêng có chữ ký, TTL5 phút; ràng buộc người/sản phẩm/địa chỉ, restart không mất', async () => {
  const { service, state, verify } = fixture(), quote = await service.estimate(input, { UserId: 1 });
  assert.equal((new Date(quote.expiresAt) - new Date(quote.issuedAt)) / 1000, TTL_SECONDS);
  assert.equal((await verify(quote)).snapshot.routeDistanceKm, null);
  const q = token.read(quote.quoteId); assert.equal(q.type, 'D12_QUOTE');
  const [prefix, body, signature] = quote.quoteId.split('.');
  for (const field of ['amount', 'ruleId', 'deliveryArea', 'vehicleType', 'expiresAt', 'listingId', 'buyerId']) {
    const edited = { ...q, [field]: 'tampered' };
    await assert.rejects(verify({ quoteId: `${prefix}.${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${signature}` }), { code: 'DELIVERY_QUOTE_INVALID' });
  }
  assert.throws(() => token.read(`JWT.${body}.${signature}`), { code: 'DELIVERY_QUOTE_INVALID' });
  state.listing.ListingId = 2; await assert.rejects(verify(quote), { code: 'DELIVERY_QUOTE_INVALID' }); state.listing.ListingId = 1;
  await assert.rejects(service.verifyQuote({ quoteId: quote.quoteId, listing, buyerId: 99, receiverAddress: input.receiverAddress, transaction: {} }), { code: 'DELIVERY_QUOTE_INVALID' });
  await assert.rejects(service.verifyQuote({ quoteId: quote.quoteId, listing, buyerId: 1, receiverAddress: 'Changed detail same area', transaction: {} }), { code: 'DELIVERY_QUOTE_INVALID' });
  state.now = new Date(NOW.getTime() + TTL_SECONDS * 1000); await assert.rejects(verify(quote), { code: 'DELIVERY_QUOTE_EXPIRED' });
});
test('D12 bảng phí/điểm lấy thay đổi bắt buộc báo giá lại; không sửa snapshot đã cấp', async () => {
  for (const change of [s => { s.rules[0].FeeAmount = '0.20'; }, s => { s.rules[0].EstimatedMinutes = 5; }, s => { s.store.Address = 'New address'; }, s => { s.rules[0].RuleId = 9; }]) {
    const { state, service, verify } = fixture(), quote = await service.estimate(input, { UserId: 1 }); change(state);
    await assert.rejects(verify(quote), { code: 'DELIVERY_QUOTE_CHANGED' }); assert.equal(quote.amount, '0.10');
  }
});
