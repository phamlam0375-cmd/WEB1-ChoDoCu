'use strict';

const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, Listings, Users, Store, RefundRequests, StatusHistories } = require('../../models');
const { notify } = require('../../services/notification.service');

const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, work);

async function readState(id, transaction) {
  // Cùng thứ tự khóa D02/job: ORDER -> PAYMENT. Không đọc trạng thái snapshot cũ.
  const order = await Orders.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  if (!order) return null;
  const payment = await Payments.findOne({ where: { OrderId: id }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const refund = await RefundRequests.findOne({ where: { OrderId: id, Status: { [Op.ne]: 'REJECTED' } }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const deliveries = await sequelize.query('SELECT DeliveryId FROM Deliveries WHERE OrderId = :id FOR UPDATE', { replacements: { id }, transaction, type: QueryTypes.SELECT });
  const store = await Store.findOne({ where: { OwnerId: order.SellerId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const seller = await Users.findByPk(order.SellerId, { attributes: ['UserId', 'FullName', 'Status'], transaction, raw: true });
  const listing = await Listings.findByPk(order.ListingId, { attributes: ['ListingId', 'Title'], transaction, raw: true });
  return { order, payment, store, seller, listing, refund, deliveries };
}

const createPayment = async (data, transaction) => (await Payments.create(data, { transaction })).get({ plain: true });
const reportPayment = async (payment, data, transaction) => {
  const [count] = await Payments.update(data, { where: { PaymentId: payment.PaymentId, OrderId: payment.OrderId, Status: payment.Status }, transaction });
  return count;
};
const createHistory = (data, transaction) => StatusHistories.create(data, { transaction });
const notifySeller = (id, data, transaction) => notify(id, data, { transaction });

module.exports = { withTransaction, readState, createPayment, reportPayment, createHistory, notifySeller };
