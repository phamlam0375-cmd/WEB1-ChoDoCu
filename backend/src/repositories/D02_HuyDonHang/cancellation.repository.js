'use strict';

const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, Listings, RefundRequests, StatusHistories } = require('../../models');
const { reopenListing } = require('../order.repository');
const { notify } = require('../../services/notification.service');

// Khóa ORDER trước PAYMENT/DELIVERY rồi LISTING. Khóa cả khoảng OrderId chưa có
// payment/delivery (unique index, REPEATABLE READ), không chỉ bản ghi đã tồn tại.
const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, work);

async function readState(orderId, transaction) {
  const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  if (!order) return null;
  const payment = await Payments.findOne({ where: { OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  // Deliveries đã có trong migration chung, chưa có model/API D07–D10.
  const deliveries = await sequelize.query('SELECT DeliveryId, Status FROM Deliveries WHERE OrderId = :orderId FOR UPDATE', {
    replacements: { orderId }, transaction, type: QueryTypes.SELECT,
  });
  const listing = await Listings.findByPk(order.ListingId, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const refund = await RefundRequests.findOne({
    where: { OrderId: orderId, Status: { [Op.notIn]: ['REJECTED', 'COMPLETED'] } }, transaction, raw: true,
  });
  return { order, payment, listing, deliveries, refund };
}

async function markCancelled(order, reason, transaction) {
  const [affected] = await Orders.update({ Status: 'CANCELLED', CancelReason: reason }, {
    where: { OrderId: order.OrderId, BuyerId: order.BuyerId, Status: order.Status }, transaction,
  });
  return affected;
}

const createHistory = (data, transaction) => StatusHistories.create(data, { transaction });
const notifyUser = (id, payload, transaction) => notify(id, payload, { transaction });

module.exports = { withTransaction, readState, markCancelled, reopenListing, createHistory, notifyUser };
