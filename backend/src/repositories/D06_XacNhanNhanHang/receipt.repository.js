'use strict';
const { QueryTypes, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, RefundRequests, Listings, StatusHistories } = require('../../models');
const { createCommissionForOrder } = require('../../services/commission.service');
const { notify } = require('../../services/notification.service');
const { getSettingAt } = require('../../services/settings.service');

const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, work);
const withSnapshot = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, work);
function readOrder(id, transaction, lock = false) {
  return Orders.findByPk(id, { attributes: ['OrderId', 'BuyerId', 'SellerId', 'ListingId', 'DeliveryMethod', 'Status', 'ProductAmount', 'DeliveryFee', 'TotalAmount', 'CommissionRate', 'CreatedAt', 'CompletedAt'], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}), raw: true });
}
async function readRelated(order, transaction, lock = false) {
  const id = order.OrderId;
  // ORDER là mutex chung D02/D03/D04/B06. Không khóa REFUND: B07 hiện dùng
  // REFUND -> ORDER, khóa ngược lại sẽ gây deadlock. SELECT snapshot đầu tiên
  // chỉ chạy sau khi đã lấy ORDER mutex nên thấy refund đã commit trước đó.
  const payment = await Payments.findOne({ where: { OrderId: id }, attributes: ['PaymentId', 'OrderId', 'PayerId', 'PayeeId', 'Amount', 'Status', 'ProofUrl', 'ReportedAt', 'ConfirmedBy', 'ConfirmedAt', 'BankName', 'BankAccountSnapshot', 'BankAccountHolderSnapshot', 'TransferContent'], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}), raw: true });
  const deliveries = await sequelize.query(`SELECT DeliveryId, OrderId, DriverId, Status, VerifiedAt, DeliveredAt, ReturnedAt, ProofUrl FROM Deliveries WHERE OrderId = :id${lock ? ' FOR UPDATE' : ''}`, { replacements: { id }, type: QueryTypes.SELECT, transaction });
  const refunds = await RefundRequests.findAll({ where: { OrderId: id }, attributes: ['Status'], transaction, raw: true });
  const listing = await Listings.findByPk(order.ListingId, { attributes: ['ListingId', 'SellerId', 'Title', 'Status'], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}), raw: true });
  const refundWindowDays = order.CompletedAt ? await getSettingAt('REFUND_WINDOW_DAYS', order.CreatedAt, { transaction }) : undefined;
  return { order, payment, deliveries, refunds, listing, refundWindowDays };
}
async function markCompleted(order, now, transaction) {
  const [count] = await Orders.update({ Status: 'COMPLETED', CompletedAt: now }, { where: { OrderId: order.OrderId, BuyerId: order.BuyerId, Status: 'DELIVERED', CompletedAt: null }, transaction });
  return count;
}
const markListingSold = (order, transaction) => Listings.update({ Status: 'SOLD' }, { where: { ListingId: order.ListingId, SellerId: order.SellerId, Status: 'RESERVED' }, transaction });
const createHistory = (data, transaction) => StatusHistories.create(data, { transaction });
const createCommission = (id, transaction) => createCommissionForOrder(id, { transaction });
const notifyUser = (id, payload, transaction) => notify(id, payload, { transaction });
module.exports = { withTransaction, withSnapshot, readOrder, readRelated, markCompleted, markListingSold, createHistory, createCommission, notifyUser };
