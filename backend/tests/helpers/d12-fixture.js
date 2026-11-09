'use strict';
// Guard DB/UUID nằm trong helper chung, chạy trước mọi model write.
const assert = require('node:assert/strict');
const { createEnvironment } = require('./d08-fixture');
const { pngReceipt } = require('../D03_ThanhToan/fixtures');
async function createD12Environment(options) {
  const f = await createEnvironment(options);
  const { Store, Listings, Categories, DeliveryFeeRules, DriverProfiles, Orders } = f.models;
  const area = `${f.prefix}_A`, otherArea = `${f.prefix}_B`;
  const store = await Store.create({ OwnerId: f.seller.UserId, StoreName: `${f.prefix} store`, Status: 'ACTIVE',
    Address: 'Điểm lấy hàng fixture D12', PickupArea: area, BankName: 'TEST BANK', BankAccountNumber: '0012345678', BankAccountHolder: 'TEST SELLER' });
  const category = await Categories.findOne({ where: { CategoryName: f.prefix } });
  const rule = await DeliveryFeeRules.create({ PickupArea: area, DeliveryArea: area, VehicleType: 'MOTORBIKE', FeeAmount: '20000.20', EstimatedMinutes: null, Status: 'ACTIVE' });
  const crossRule = await DeliveryFeeRules.create({ PickupArea: area, DeliveryArea: otherArea, VehicleType: 'TRUCK', FeeAmount: '30000.30', EstimatedMinutes: 40, Status: 'ACTIVE' });
  let sequence = 0;
  const listing = (values = {}) => Listings.create({ SellerId: f.seller.UserId, StoreId: store.StoreId, CategoryId: category.CategoryId,
    Title: `${f.prefix}_product${++sequence}`, Description: 'D12 isolated test fixture', Price: '100000.10', ConditionLevel: 'GOOD', Location: 'Địa chỉ hiển thị không dùng suy đoán khu vực', Status: 'ACTIVE', ...values });
  const input = product => ({ listingId: product.ListingId, deliveryArea: area, vehicleType: 'MOTORBIKE', receiverAddress: 'Nhà số 1, địa chỉ nhận fixture' });
  const estimate = (product, changes = {}, user = f.buyer) => f.request('/api/v1/delivery-fees/estimate', { user, method: 'POST', body: { ...input(product), ...changes } });
  const orderBody = (product, quote) => ({ listingId: product.ListingId, deliveryMethod: 'DELIVERY', receiverName: 'Test Buyer', receiverPhone: '0900000111', receiverAddress: input(product).receiverAddress, deliveryQuoteId: quote.quoteId });
  const createOrder = (product, quote, changes = {}, user = f.buyer) => f.request('/api/v1/orders', { user, method: 'POST', body: { ...orderBody(product, quote), ...changes } });
  async function pay(orderId) {
    const accepted = await f.request(`/api/seller/store/order/${orderId}/status`, { user: f.seller, method: 'PATCH', body: { status: 'CONFIRM' } }); assert.equal(accepted.status, 200, 'C05 chấp nhận qua API');
    const info = await f.request(`/api/v1/orders/${orderId}/payment-info`, { user: f.buyer }); assert.equal(info.status, 200, 'D03 thông tin thanh toán');
    const order = await Orders.findByPk(orderId);
    const report = await f.request(`/api/v1/orders/${orderId}/payment-notice`, { user: f.buyer, method: 'POST', body: { amount: order.ProductAmount }, file: { buffer: pngReceipt() } }); assert.equal(report.status, 200, 'D03 báo tiền sản phẩm');
    const preview = await f.request(`/api/v1/seller/orders/${orderId}/payment`, { user: f.seller }); assert.equal(preview.status, 200);
    const confirm = await f.request(`/api/v1/seller/orders/${orderId}/payment`, { user: f.seller, method: 'PATCH', body: { action: 'CONFIRM', reportVersion: preview.body.data.reportVersion } }); assert.equal(confirm.status, 200, 'D04 đối chiếu tiền sản phẩm');
    return { info: info.body.data, payment: confirm.body.data };
  }
  async function driver(label) {
    const user = await f.person(label, { driver: true });
    await DriverProfiles.update({ ServiceArea: area }, { where: { UserId: user.UserId } }); return user;
  }
  return { ...f, area, otherArea, store, rule, crossRule, listing, input, estimate, createOrder, orderBody, pay, driver };
}
module.exports = { createD12Environment };
