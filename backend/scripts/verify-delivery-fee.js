'use strict';
if (process.env.D12_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('D12 chỉ kiểm thử trên MySQL local/test riêng đã guard UUID.');
process.env.AUTH_DEV_HEADER = 'false'; process.env.D01_DEMO_MODE = 'false';
const assert = require('node:assert/strict');
const { createD12Environment } = require('../tests/helpers/d12-fixture');
const { createFeeService } = require('../src/services/D12_UocTinhPhiGiaoHang/fee.service');
const repo = require('../src/repositories/D12_UocTinhPhiGiaoHang/fee.repository');
let f, count = 0;
const check = async (name, work) => { await work(); console.log(`PASS D12 ${++count}: ${name}`); };
async function main() {
  f = await createD12Environment();
  const { Orders, Deliveries, Payments, Commissions, Listings, DeliveryFeeRules, Store, StatusHistories, sequelize } = f.models;
  const counts = async () => [await Orders.count(), await Deliveries.count(), await Payments.count(), await Commissions.count(), await StatusHistories.count()];
  const product = await f.listing();
  const quote = async (p = product, input, user) => { const r = await f.estimate(p, input, user); assert.equal(r.status, 200, r.body.message); return r.body.data; };
  await check('JWT thật và C02 đúng chủ; không x-user-id/demo, không tự sửa điểm lấy/phí', async () => {
    for (const headers of [{}, { 'x-user-id': String(f.buyer.UserId) }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }]) assert.equal((await f.request('/api/v1/delivery-fees/estimate', { method: 'POST', headers, body: f.input(product) })).status, 401);
    for (const body of [{ pickupArea: f.otherArea }, { amount: 0 }, { ruleId: f.rule.RuleId }, { expiresAt: '2099-01-01' }]) assert.equal((await f.estimate(product, body)).status, 422);
    assert.equal((await f.request(`/api/stores/${f.seller.UserId}`, { method: 'PATCH', body: { StoreName: 'Bad' } })).status, 401);
    assert.equal((await f.request(`/api/stores/${f.seller.UserId}`, { user: f.buyer, method: 'PATCH', body: { StoreName: 'Bad' } })).status, 403);
    assert.equal((await f.estimate(product, {}, f.seller)).status, 403);
  });
  await check('Tính phí chỉ đọc; từ C02, đúng tiền lẻ, NULL phút, không tạo đơn/giữ món/chuyến/payment/hoa hồng', async () => {
    const before = await counts(), q = await quote();
    assert.equal(q.amount, '20000.20'); assert.equal(q.estimatedMinutes, null); assert.equal(q.pickupArea, f.area); assert.equal(q.vehicleType, 'MOTORBIKE');
    assert.equal(new Date(q.expiresAt) - new Date(q.issuedAt), 300000); assert.deepEqual(await counts(), before); assert.equal((await product.reload()).Status, 'ACTIVE');
  });
  await check('Tuyến có chiều, phương tiện/khu vực exact; INACTIVE/thiếu tuyến không trả 0 giả', async () => {
    const q = await quote(product, { deliveryArea: f.otherArea, vehicleType: 'TRUCK' }); assert.equal(q.amount, '30000.30'); assert.equal(q.estimatedMinutes, 40);
    for (const body of [{ deliveryArea: `${f.area}_OTHER` }, { vehicleType: 'UNSUPPORTED' }, { vehicleType: 'TRUCK' }, { deliveryArea: '' }, { receiverAddress: '' }]) assert.equal((await f.estimate(product, body)).status, 422);
    await f.rule.update({ Status: 'INACTIVE' }); assert.equal((await f.estimate(product)).body.code, 'DELIVERY_ROUTE_UNSUPPORTED'); await f.rule.update({ Status: 'ACTIVE' });
    await f.store.update({ PickupArea: f.otherArea }); assert.equal((await f.estimate(product, { deliveryArea: f.area, vehicleType: 'TRUCK' })).body.code, 'DELIVERY_ROUTE_UNSUPPORTED'); await f.store.update({ PickupArea: f.area });
  });
  await check('Trùng ACTIVE báo xung đột, mức 0 thật hợp lệ; thiếu pickup không đoán từ Location', async () => {
    const duplicate = await DeliveryFeeRules.create({ PickupArea: ` ${f.area.toLowerCase()} `, DeliveryArea: f.area, VehicleType: 'motorbike', FeeAmount: '0', Status: 'ACTIVE' });
    assert.equal((await f.estimate(product)).body.code, 'DELIVERY_RULE_CONFLICT'); await duplicate.update({ Status: 'INACTIVE' });
    await f.rule.update({ FeeAmount: '0.00' }); assert.equal((await quote()).amount, '0.00'); await f.rule.update({ FeeAmount: '20000.20' });
    await f.store.update({ PickupArea: null }); assert.equal((await f.estimate(product)).body.code, 'DELIVERY_PICKUP_INCOMPLETE'); await f.store.update({ PickupArea: f.area });
  });
  await check('Sửa token/giá/RuleId/thời hạn/tuyến, sai buyer/listing/địa chỉ không giữ món dở dang', async () => {
    const q = await quote(), other = await f.listing(), before = await counts();
    const [prefix, data, signature] = q.quoteId.split('.'), decoded = JSON.parse(Buffer.from(data, 'base64url'));
    for (const key of ['amount', 'ruleId', 'expiresAt', 'deliveryArea', 'vehicleType']) {
      const body = Buffer.from(JSON.stringify({ ...decoded, [key]: 'tampered' })).toString('base64url');
      assert.equal((await f.createOrder(product, { ...q, quoteId: `${prefix}.${body}.${signature}` })).body.code, 'DELIVERY_QUOTE_INVALID');
    }
    for (const fields of [{ deliveryFee: 0 }, { deliveryFeeRuleId: 1 }, { expiresAt: '2099' }, { amount: '0' }]) assert.equal((await f.createOrder(product, q, fields)).status, 422);
    assert.equal((await f.createOrder(other, q)).body.code, 'DELIVERY_QUOTE_INVALID'); assert.equal((await f.createOrder(product, q, {}, f.outsider)).body.code, 'DELIVERY_QUOTE_INVALID');
    assert.equal((await f.createOrder(product, q, { receiverAddress: 'Khác chi tiết trong cùng khu vực' })).body.code, 'DELIVERY_QUOTE_INVALID');
    assert.deepEqual(await counts(), before); assert.equal((await product.reload()).Status, 'ACTIVE'); assert.equal((await other.reload()).Status, 'ACTIVE');
  });
  await check('Báo giá hết hạn, đổi giá/vô hiệu hóa/đổi pickup: rollback; báo giá cũ tồn tại qua service restart', async () => {
    const before = await counts(), expired = await createFeeService({ repository: repo, clock: () => new Date(Date.now() - 301000) }).estimate(f.input(product), f.buyer);
    assert.equal((await f.createOrder(product, expired)).body.code, 'DELIVERY_QUOTE_EXPIRED');
    const q = await quote();
    const restarted = createFeeService({ repository: repo }); await sequelize.transaction(async transaction => { assert.equal((await restarted.verifyQuote({ quoteId: q.quoteId, listing: product.get({ plain: true }), receiverAddress: f.input(product).receiverAddress, buyerId: f.buyer.UserId, transaction })).amount, q.amount); });
    await f.rule.update({ FeeAmount: '999.99' }); assert.equal((await f.createOrder(product, q)).body.code, 'DELIVERY_QUOTE_CHANGED'); await f.rule.update({ FeeAmount: '20000.20' });
    const q2 = await quote(); await f.rule.update({ Status: 'INACTIVE' }); assert.equal((await f.createOrder(product, q2)).body.code, 'DELIVERY_ROUTE_UNSUPPORTED'); await f.rule.update({ Status: 'ACTIVE' });
    const q3 = await quote(); await f.store.update({ Address: 'Điểm lấy thay đổi' }); assert.equal((await f.createOrder(product, q3)).body.code, 'DELIVERY_QUOTE_CHANGED'); await f.store.update({ Address: 'Điểm lấy hàng fixture D12' });
    assert.deepEqual(await counts(), before); assert.equal((await product.reload()).Status, 'ACTIVE');
  });
  let created;
  await check('D01 chốt snapshot/giữ món, cộng tiền chính xác; PICKUP xóa báo giá/rule/phí và không tạo chuyến', async () => {
    const result = await f.createOrder(product, await quote()); assert.equal(result.status, 201); created = await Orders.findByPk(result.body.data.orderId);
    assert.equal(created.ProductAmount, '100000.10'); assert.equal(created.DeliveryFee, '20000.20'); assert.equal(created.TotalAmount, '120000.30'); assert.equal(created.DeliveryQuoteSnapshot.vehicleType, 'MOTORBIKE');
    assert.equal(created.DeliveryFeeRuleId, f.rule.RuleId); assert.equal((await product.reload()).Status, 'RESERVED'); assert.equal(await Deliveries.count({ where: { OrderId: created.OrderId } }), 0);
    const p = await f.listing(), q = await quote(p), pickup = await f.createOrder(p, q, { deliveryMethod: 'PICKUP' }); assert.equal(pickup.status, 201);
    const order = await Orders.findByPk(pickup.body.data.orderId); assert.equal(order.DeliveryFee, '0.00'); assert.equal(order.TotalAmount, '100000.10'); assert.equal(order.DeliveryFeeRuleId, null); assert.equal(order.DeliveryQuoteSnapshot, null); assert.equal(order.ReceiverAddress, null);
    assert.equal(await Deliveries.count({ where: { OrderId: order.OrderId } }), 0);
  });
  await check('Hai buyer giữ cùng sản phẩm với báo giá riêng: đúng một winner', async () => {
    const p = await f.listing(), q1 = await quote(p), q2 = await quote(p, {}, f.outsider);
    const results = await Promise.all([f.createOrder(p, q1), f.createOrder(p, q2, {}, f.outsider)]); assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(await Orders.count({ where: { ListingId: p.ListingId } }), 1);
  });
  await check('D05 đọc snapshot đơn cũ sau đổi phí/địa chỉ, không truy tính lại', async () => {
    await f.rule.update({ FeeAmount: '99999.99' }); await f.store.update({ Address: 'Địa chỉ mới không thay đơn cũ', PickupArea: f.otherArea });
    const tracking = await f.request(`/api/v1/orders/${created.OrderId}/tracking`, { user: f.buyer }); assert.equal(tracking.status, 200);
    assert.equal(tracking.body.data.productAmount, '100000.10'); assert.equal(tracking.body.data.deliveryFee, '20000.20'); assert.equal(tracking.body.data.totalAmount, '120000.30');
    assert.equal((await created.reload()).DeliveryQuoteSnapshot.pickupArea, f.area);
  });
  await check('C05 -> D03 -> D04 -> C07 thật: chỉ ProductAmount vào Payments, chuyến lấy snapshot cũ không phụ thuộc phí hiện tại', async () => {
    await f.pay(created.OrderId);
    const payment = await Payments.findOne({ where: { OrderId: created.OrderId } }); assert.equal(payment.Amount, created.ProductAmount); assert.equal(payment.Status, 'CONFIRMED');
    assert.equal(await Deliveries.count({ where: { OrderId: created.OrderId } }), 0, 'D04 không tự tạo chuyến');
    assert.equal((await f.request(`/api/seller/orders/${created.OrderId}/preparation`, { user: f.buyer, method: 'POST', body: {} })).status, 403);
    const prepared = await f.request(`/api/seller/orders/${created.OrderId}/preparation`, { user: f.seller, method: 'POST', body: {} }); assert.equal(prepared.status, 201, prepared.body.message);
    const d = await Deliveries.findByPk(prepared.body.data.DeliveryId); assert.equal(d.PickupArea, f.area); assert.equal(d.DeliveryArea, f.area); assert.equal(d.PickupAddress, 'Điểm lấy hàng fixture D12'); assert.equal(d.VehicleType, 'MOTORBIKE'); assert.equal(d.DriverFee, '20000.20'); assert.equal(d.RouteDistanceKm, null); assert.equal(d.DriverId, null);
    const secret = await Deliveries.findByPk(d.DeliveryId, { attributes: ['PickupCodeHash'] }); assert.equal(secret.PickupCodeHash, null, 'C07 không cấp mã trước D08');
    created.delivery = d;
  });
  await check('D07/D11 dùng đúng phương tiện/tuyến/nhận phí/bán kính; không cộng hoa hồng phí tài xế', async () => {
    const d = created.delivery, wrong = await f.driver(); await f.models.DriverProfiles.update({ VehicleType: 'TRUCK' }, { where: { UserId: wrong.UserId } });
    const call = user => f.request(`/api/v1/driver/deliveries/${d.DeliveryId}/accept`, { user, method: 'PATCH', body: {} });
    assert.equal((await call(wrong)).status, 409);
    const accent = await f.driver(); await f.models.DriverProfiles.update({ ServiceArea: f.area.replace(/_A$/, '_Á') }, { where: { UserId: accent.UserId } });
    assert.equal((await call(accent)).status, 409, 'Không để collation bỏ dấu coi hai mã khu vực khác nhau là một');
    const radius = await f.driver(); await f.models.DriverProfiles.update({ MaxDistanceKm: '1.00' }, { where: { UserId: radius.UserId } }); assert.equal((await call(radius)).status, 409, 'Không giả số km từ tên khu vực');
    const driver = await f.driver(); assert.equal((await call(driver)).status, 200);
    assert.equal((await f.models.DriverProfiles.findOne({ where: { UserId: driver.UserId } })).AvailabilityStatus, 'BUSY'); assert.equal((await d.reload()).DriverFee, '20000.20');
    assert.equal(await Commissions.count({ where: { OrderId: created.OrderId } }), 0);
  });
  console.log(`D12 integration: ${count} nhóm PASS trên ${f.connection.db}; không reset/seed DB nhóm hoặc dùng CD.`);
}
main().catch(e => { console.error('FAIL D12:', e.name, e.code || '', e.message); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
