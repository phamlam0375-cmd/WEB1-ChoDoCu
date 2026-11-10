'use strict';
const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const v = require('../../validators/D12_UocTinhPhiGiaoHang/fee.validator');
const defaultRepository = require('../../repositories/D12_UocTinhPhiGiaoHang/fee.repository');
const token = require('./quote.token');
const TTL_SECONDS = 300;
const fail = (status, code, message) => new HttpError(status, message, null, code);
const fingerprint = rule => crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex');
function createFeeService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  async function run(work) {
    try { return await repository.withTransaction(work); }
    catch (e) {
      const code = e.original?.code || e.parent?.code;
      if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(code)) throw fail(503, 'D12_SCHEMA_NOT_READY', 'Database chưa áp dụng migration phí giao hàng.');
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) throw fail(409, 'DELIVERY_QUOTE_CONFLICT', 'Dữ liệu giao hàng đang thay đổi. Vui lòng thử lại.');
      throw e;
    }
  }
  async function source(listing, tx, lock = false) {
    const store = await repository.pickup(listing, tx, lock);
    const seller = await repository.user(listing.SellerId, tx);
    if (!store || store.Status !== 'ACTIVE' || seller?.Status !== 'ACTIVE' || !store.Address?.trim() || !store.PickupArea?.trim()) throw fail(422, 'DELIVERY_PICKUP_INCOMPLETE', 'Người bán cần bổ sung địa chỉ và khu vực lấy hàng tại cửa hàng. Bạn có thể chọn tự đến lấy.');
    return { storeId: Number(store.StoreId), pickupAddress: v.text(store.Address, 255, 'pickupAddress'), pickupArea: v.text(store.PickupArea, 100, 'pickupArea') };
  }
  function choose(rows, pickupArea, deliveryArea, vehicleType) {
    const matched = rows.filter(r => v.key(r.PickupArea) === v.key(pickupArea) && v.key(r.DeliveryArea) === v.key(deliveryArea) && v.key(r.VehicleType) === v.key(vehicleType));
    if (!matched.length) throw fail(422, 'DELIVERY_ROUTE_UNSUPPORTED', 'Chưa hỗ trợ tuyến giao này; hãy chọn tự đến lấy.');
    if (matched.length !== 1) throw fail(409, 'DELIVERY_RULE_CONFLICT', 'Có nhiều quy tắc ACTIVE cùng tuyến và phương tiện. Cần quản trị thống nhất bảng phí trước khi đặt.');
    return v.rule(matched[0]);
  }
  async function context(listingId) {
    return run(async tx => {
      const listing = await repository.listing(v.id(listingId), tx);
      if (!listing) throw fail(404, 'LISTING_NOT_FOUND', 'Không tìm thấy sản phẩm.');
      let pickup = null, message = '';
      try { pickup = await source(listing, tx); } catch (e) { if (e.code !== 'DELIVERY_PICKUP_INCOMPLETE') throw e; message = e.message; }
      const rules = await repository.rules(tx);
      if (!rules.length && !message) message = 'Chưa có quy tắc phí ACTIVE. Hãy chọn tự đến lấy hoặc liên hệ người bán.';
      const routes = rules.filter(r => pickup && v.key(r.PickupArea) === v.key(pickup.pickupArea)).map(r => ({ deliveryArea: r.DeliveryArea, vehicleType: r.VehicleType }));
      return { available: true, estimateEndpoint: '/api/v1/delivery-fees/estimate', pickup, routes, deliveryAreas: [...new Set(rules.map(r => r.DeliveryArea))], vehicleTypes: [...new Set(rules.map(r => r.VehicleType))], message, quoteTtlSeconds: TTL_SECONDS };
    });
  }
  async function estimate(body, user) {
    const input = v.estimate(body), buyerId = v.id(user?.UserId ?? user?.userId, 'buyerId');
    return run(async tx => {
      const buyer = await repository.user(buyerId, tx);
      if (buyer?.Status !== 'ACTIVE') throw fail(403, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không được phép hoạt động.');
      const listing = await repository.listing(input.listingId, tx);
      if (!listing) throw fail(404, 'LISTING_NOT_FOUND', 'Không tìm thấy sản phẩm.');
      if (listing.Status !== 'ACTIVE') throw fail(409, 'LISTING_UNAVAILABLE', 'Sản phẩm hiện không còn khả dụng.');
      if (Number(listing.SellerId) === buyerId) throw fail(403, 'CANNOT_BUY_OWN_LISTING', 'Bạn không thể mua sản phẩm của chính mình.');
      const pickup = await source(listing, tx), rule = choose(await repository.rules(tx), pickup.pickupArea, input.deliveryArea, input.vehicleType);
      const issuedAt = Math.floor(clock().getTime() / 1000), expiresAt = issuedAt + TTL_SECONDS;
      const snapshot = { type: 'D12_QUOTE', version: 1, buyerId, listingId: input.listingId, sellerId: Number(listing.SellerId),
        ...pickup, pickupArea: rule.pickupArea, deliveryArea: rule.deliveryArea, vehicleType: rule.vehicleType, receiverAddress: input.receiverAddress,
        ruleId: rule.ruleId, amount: rule.amount, estimatedMinutes: rule.estimatedMinutes, ruleFingerprint: fingerprint(rule), issuedAt, expiresAt };
      return { quoteId: token.sign(snapshot), amount: rule.amount, deliveryFeeRuleId: rule.ruleId, pickupArea: rule.pickupArea, deliveryArea: rule.deliveryArea,
        vehicleType: rule.vehicleType, estimatedMinutes: rule.estimatedMinutes, issuedAt: new Date(issuedAt * 1000).toISOString(), expiresAt: new Date(expiresAt * 1000).toISOString(), serverNow: clock().toISOString() };
    });
  }
  async function verifyQuote({ quoteId, receiverAddress, listing, buyerId, transaction }) {
    if (!transaction) throw new Error('D12 xác thực báo giá trong transaction tạo đơn.');
    const q = token.read(quoteId), now = Math.floor(clock().getTime() / 1000);
    if (!Number.isInteger(q.issuedAt) || !Number.isInteger(q.expiresAt) || q.expiresAt - q.issuedAt !== TTL_SECONDS || q.issuedAt > now || q.expiresAt <= now) throw fail(422, 'DELIVERY_QUOTE_EXPIRED', 'Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.');
    if (q.buyerId !== buyerId || q.listingId !== Number(listing.ListingId) || q.sellerId !== Number(listing.SellerId) || q.receiverAddress !== v.text(receiverAddress, 255, 'receiverAddress')) throw fail(422, 'DELIVERY_QUOTE_INVALID', 'Báo giá không khớp người mua, sản phẩm hoặc địa chỉ nhận. Vui lòng tính lại phí.');
    const pickup = await source(listing, transaction, true);
    const rule = choose(await repository.rules(transaction, true), pickup.pickupArea, q.deliveryArea, q.vehicleType);
    if (pickup.storeId !== q.storeId || pickup.pickupAddress !== q.pickupAddress || v.key(pickup.pickupArea) !== v.key(q.pickupArea) || fingerprint(rule) !== q.ruleFingerprint || rule.ruleId !== q.ruleId || rule.amount !== q.amount) throw fail(409, 'DELIVERY_QUOTE_CHANGED', 'Điểm lấy hàng hoặc bảng phí đã thay đổi. Vui lòng tính lại và xác nhận mức phí mới.');
    if (q.expiresAt <= Math.floor(clock().getTime() / 1000)) throw fail(422, 'DELIVERY_QUOTE_EXPIRED', 'Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.');
    return { amount: q.amount, deliveryFeeRuleId: q.ruleId, expiresAt: new Date(q.expiresAt * 1000).toISOString(), snapshot: {
      version: 1, storeId: q.storeId, pickupAddress: q.pickupAddress, pickupArea: q.pickupArea, deliveryArea: q.deliveryArea, vehicleType: q.vehicleType,
      receiverAddress: q.receiverAddress, ruleId: q.ruleId, driverFee: q.amount, estimatedMinutes: q.estimatedMinutes, routeDistanceKm: null,
      issuedAt: new Date(q.issuedAt * 1000).toISOString(), expiresAt: new Date(q.expiresAt * 1000).toISOString(),
    } };
  }
  return { context, estimate, verifyQuote };
}
module.exports = { ...createFeeService(), createFeeService, TTL_SECONDS };
