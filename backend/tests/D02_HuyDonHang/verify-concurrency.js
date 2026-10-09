'use strict';

// MySQL multi-connection/transaction thật. Chỉ tạo và dọn fixture của tiến trình;
// không seed, migrate, start job toàn DB hoặc sửa bất kỳ đơn/tin có sẵn.
require('dotenv').config();
if (process.env.NODE_ENV === 'production') throw new Error('Không chạy fixture concurrency trên DB production.');
const assert = require('node:assert/strict');
const { Op, QueryTypes } = require('sequelize');
const { sequelize, Users, Categories, Listings, Orders, Payments, StatusHistories, Notifications } = require('../../src/models');
const d01Repository = require('../../src/repositories/order.repository');
const d02Repository = require('../../src/repositories/D02_HuyDonHang/cancellation.repository');
const { createOrderService } = require('../../src/services/order.service');
const { createCancellationService } = require('../../src/services/D02_HuyDonHang/cancellation.service');

async function main() {
  let category;
  const listings = [], orders = [];
  const prefix = `D02 concurrency ${Date.now()}-${process.pid}`;
  try {
    const buyer = await Users.findOne({ where: { Status: 'ACTIVE' }, include: [{ association: 'Roles', where: { RoleName: 'USER' } }] });
    assert.ok(buyer, 'Cần tài khoản USER có sẵn, không seed.');
    const seller = await Users.findOne({ where: { Status: 'ACTIVE', UserId: { [Op.ne]: buyer.UserId } }, include: [{ association: 'Roles', where: { RoleName: 'SELLER' } }] });
    assert.ok(seller, 'Cần SELLER có sẵn.');
    category = await Categories.create({ CategoryName: prefix, Status: 'ACTIVE' });
    const d01 = createOrderService();
    const d02 = createCancellationService();
    async function fixture() {
      const listing = await Listings.create({ SellerId: seller.UserId, CategoryId: category.CategoryId, Title: prefix, Description: 'Fixture tự dọn.', Price: '123456.00', ConditionLevel: 'GOOD', Status: 'ACTIVE' }); listings.push(listing);
      const result = await d01.createOrder({ listingId: listing.ListingId, deliveryMethod: 'PICKUP', receiverName: 'D02 Test', receiverPhone: '0901234567' }, buyer.UserId);
      const order = await Orders.findByPk(result.data.orderId); orders.push(order);
      return { listing, order };
    }
    const cancel = (f, reason = 'D02 test') => d02.cancelOrder(f.order.OrderId, { reason }, buyer);
    const paymentData = (f, status) => ({ OrderId: f.order.OrderId, PayerId: buyer.UserId, PayeeId: seller.UserId, Amount: f.order.ProductAmount, TransferContent: `TEST${f.order.OrderId}`, Status: status });
    async function assertCancelledOnce(f, listingStatus = 'ACTIVE') {
      assert.equal((await Orders.findByPk(f.order.OrderId)).Status, 'CANCELLED');
      assert.equal((await Listings.findByPk(f.listing.ListingId)).Status, listingStatus);
      assert.equal(await StatusHistories.count({ where: { OrderId: f.order.OrderId, StatusValue: 'CANCELLED' } }), 1);
      assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: f.order.OrderId } }), 3);
    }
    function expiry(f) {
      return createOrderService({
        clock: () => new Date(new Date(f.order.ReservedUntil).getTime() + 1000),
        repository: { ...d01Repository, findExpiredReservations: (now, _limit, transaction) => sequelize.query(
          `SELECT OrderId, BuyerId, SellerId, ListingId FROM Orders WHERE OrderId = :id AND Status = 'RESERVED' AND ReservedUntil <= :now FOR UPDATE SKIP LOCKED`,
          { replacements: { id: f.order.OrderId, now }, transaction, type: QueryTypes.SELECT }
        ) },
      });
    }
    const repeated = await fixture();
    const results = await Promise.all([cancel(repeated, 'Đầu tiên'), cancel(repeated, 'Sau đó')]);
    assert.equal(results.filter(r => !r.data.alreadyCancelled).length, 1); await assertCancelledOnce(repeated);
    console.log('PASS SQL race: two cancels, exactly one history/two cancel notifications.');

    const expired = await fixture();
    await Promise.all([cancel(expired), expiry(expired).expireReservations()]);
    await assertCancelledOnce(expired);
    assert.equal((await expiry(expired).expireReservations()).expiredCount, 0);
    console.log('PASS SQL race: cancel vs D01 expiry; one cancellation, idempotent expiry.');

    const paid = await fixture();
    let signalPaymentLock, releasePayment;
    const paymentLocked = new Promise(resolve => { signalPaymentLock = resolve; });
    const paymentGate = new Promise(resolve => { releasePayment = resolve; });
    const confirm = sequelize.transaction(async transaction => {
      const order = await Orders.findByPk(paid.order.OrderId, { transaction, lock: transaction.LOCK.UPDATE });
      signalPaymentLock(); await paymentGate;
      await Payments.create(paymentData(paid, 'CONFIRMED'), { transaction });
      await order.update({ Status: 'PAID' }, { transaction });
    });
    await paymentLocked;
    const cancelledWhilePaid = cancel(paid).then(() => null, error => error);
    releasePayment(); await confirm;
    assert.equal((await cancelledWhilePaid).code, 'REFUND_REQUIRED');
    assert.equal((await Listings.findByPk(paid.listing.ListingId)).Status, 'RESERVED');
    assert.equal(await StatusHistories.count({ where: { OrderId: paid.order.OrderId, StatusValue: 'CANCELLED' } }), 0);
    console.log('PASS SQL race: payment confirmation holds ORDER; cancellation waits and sees PAID/CONFIRMED, never reopens.');

    const firstCancel = await fixture();
    let signalCancelLock, releaseCancel;
    const cancelLocked = new Promise(resolve => { signalCancelLock = resolve; });
    const cancelGate = new Promise(resolve => { releaseCancel = resolve; });
    let notified = false;
    const controlled = createCancellationService({ repository: { ...d02Repository, async notifyUser(...args) {
      if (!notified) { notified = true; signalCancelLock(); await cancelGate; }
      return d02Repository.notifyUser(...args);
    } } });
    const pendingCancel = controlled.cancelOrder(firstCancel.order.OrderId, { reason: 'Hủy trước xác nhận' }, buyer);
    await cancelLocked;
    // C06/D04 chưa có API: mô phỏng writer dùng khóa ORDER và kiểm tra trạng thái mới nhất.
    const laterPayment = sequelize.transaction(async transaction => {
      const order = await Orders.findByPk(firstCancel.order.OrderId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!['RESERVED', 'WAITING_PAYMENT'].includes(order.Status)) return false;
      await Payments.create(paymentData(firstCancel, 'CONFIRMED'), { transaction }); return true;
    });
    releaseCancel(); await pendingCancel;
    assert.equal(await laterPayment, false); await assertCancelledOnce(firstCancel);
    assert.equal(await Payments.count({ where: { OrderId: firstCancel.order.OrderId } }), 0);
    console.log('PASS SQL race: cancel commits first, guarded payment writer sees CANCELLED. C06/D04 APIs are not implemented in current repo.');

    const reported = await fixture();
    await Payments.create(paymentData(reported, 'REPORTED'));
    await assert.rejects(cancel(reported), { code: 'PAYMENT_VERIFICATION_REQUIRED' });
    assert.equal((await expiry(reported).expireReservations()).expiredCount, 0);
    assert.equal((await Orders.findByPk(reported.order.OrderId)).Status, 'RESERVED');
    assert.equal((await Listings.findByPk(reported.listing.ListingId)).Status, 'RESERVED');
    console.log('PASS SQL: REPORTED blocks cancellation AND expiration.');

    const hidden = await fixture();
    await hidden.listing.update({ Status: 'HIDDEN' }); await cancel(hidden); await assertCancelledOnce(hidden, 'HIDDEN');
    const sold = await fixture();
    await sold.listing.update({ Status: 'SOLD' }); await cancel(sold); await assertCancelledOnce(sold, 'SOLD');
    const another = await fixture();
    const extra = await Orders.create({ ...another.order.get({ plain: true }), OrderId: undefined, Status: 'WAITING_PAYMENT' }); orders.push(extra);
    await cancel(another); await assertCancelledOnce(another, 'RESERVED');
    assert.equal((await Orders.findByPk(extra.OrderId)).Status, 'WAITING_PAYMENT');
    console.log('PASS SQL: HIDDEN/SOLD remain unchanged; another processing order keeps listing RESERVED.');

    const delivering = await fixture();
    await sequelize.query('INSERT INTO Deliveries (OrderId, PickupAddress, DeliveryAddress, Status) VALUES (:id, :pickup, :address, :status)', {
      replacements: { id: delivering.order.OrderId, pickup: 'Fixture pickup', address: 'Fixture delivery', status: 'DELIVERING' }, type: QueryTypes.INSERT,
    });
    await assert.rejects(cancel(delivering), { code: 'ORDER_NOT_CANCELLABLE' });
    assert.equal((await expiry(delivering).expireReservations()).expiredCount, 0);
    assert.equal((await Listings.findByPk(delivering.listing.ListingId)).Status, 'RESERVED');
    console.log('PASS SQL: active delivery prevents cancellation and expiration from reopening listing.');

    const accepted = await fixture();
    await accepted.order.update({ Status: 'WAITING_PAYMENT' }); await cancel(accepted); await assertCancelledOnce(accepted);
    console.log('PASS SQL: latest WAITING_PAYMENT without reported/confirmed payment cancels normally.');
  } finally {
    try {
      if (category) await sequelize.transaction(async transaction => {
        const ids = listings.map(l => l.ListingId);
        // Kiểm tra chính xác phạm vi trước khi dọn fixture tự tạo; không dùng glob/seed/reset.
        const own = await Listings.findAll({ where: { CategoryId: category.CategoryId }, transaction });
        assert.deepEqual(own.map(l => l.ListingId).sort((a,b) => a-b), [...ids].sort((a,b) => a-b));
        assert.ok(own.every(l => l.Title === prefix));
        const rows = ids.length ? await Orders.findAll({ where: { ListingId: ids }, transaction }) : [];
        const orderIds = rows.map(o => o.OrderId);
        if (orderIds.length) {
          await Notifications.destroy({ where: { ReferenceType: 'ORDER', ReferenceId: orderIds }, transaction });
          await StatusHistories.destroy({ where: { OrderId: orderIds }, transaction });
          await Payments.destroy({ where: { OrderId: orderIds }, transaction });
          await sequelize.query('DELETE FROM Deliveries WHERE OrderId IN (:orderIds)', { replacements: { orderIds }, transaction, type: QueryTypes.DELETE });
          await Orders.destroy({ where: { OrderId: orderIds }, transaction });
        }
        if (ids.length) await Listings.destroy({ where: { ListingId: ids, CategoryId: category.CategoryId, Title: prefix }, transaction });
        await Categories.destroy({ where: { CategoryId: category.CategoryId, CategoryName: prefix }, transaction });
      });
      console.log('PASS cleanup: removed only exact newly-created D02 fixtures; existing users/listings/orders untouched.');
    } finally { await sequelize.close(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
