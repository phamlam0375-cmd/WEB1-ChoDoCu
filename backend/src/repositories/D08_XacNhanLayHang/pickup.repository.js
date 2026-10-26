'use strict';
const { Op, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, Deliveries, RefundRequests, Users, Listings, StatusHistories } = require('../../models');
const assignment = require('../D07_TaiXeNhanChuyen/assignment.repository');
const { notify } = require('../../services/notification.service');
const attributes = ['DeliveryId', 'OrderId', 'DriverId', 'Status', 'PickupAddress', 'DeliveryAddress', 'DriverFee', 'AcceptedAt', 'PickedUpAt', 'ReadyForPickupAt', 'PreparedBy',
  'PickupCodeHash', 'PickupCodeIssuedAt', 'PickupCodeExpiresAt', 'PickupCodeUsedAt', 'PickupCodeAttempts',
  'SellerHandoverAt', 'SellerHandoverBy', 'SellerHandoverDriverId', 'PickupProofKey', 'PickupProofDigest'];
const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, work);
const withSnapshot = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, work);
const locate = deliveryId => Deliveries.findByPk(deliveryId, { attributes: ['OrderId'], raw: true });
async function readState(orderId, deliveryId, transaction, lock = false) {
  const options = { transaction, raw: true, logging: false, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) };
  // Cùng mutex D07/D04/B06: ORDER -> PAYMENT -> DELIVERY -> USER/GRANT/PROFILE.
  // Không khóa REFUND ngược chiều B07 (REFUND -> ORDER).
  const order = await Orders.findByPk(orderId, options);
  if (!order) return null;
  const payment = await Payments.findOne({ where: { OrderId: orderId }, ...options });
  const delivery = await Deliveries.findOne({ where: { OrderId: orderId, ...(deliveryId ? { DeliveryId: deliveryId } : {}) }, attributes, ...options });
  const refund = await RefundRequests.findOne({ where: { OrderId: orderId, Status: { [Op.ne]: 'REJECTED' } }, transaction, raw: true });
  const seller = await Users.findByPk(order.SellerId, { attributes: ['UserId', 'FullName', 'Phone', 'Status'], transaction, raw: true });
  const listing = await Listings.findByPk(order.ListingId, { attributes: ['ListingId', 'Title', 'ConditionLevel', 'KnownDefects'], transaction, raw: true });
  return { order, payment, delivery, refund, seller, listing };
}
const actor = (id, transaction, lock = false) => Users.findByPk(id, { attributes: ['UserId', 'Status'], transaction, raw: true, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
const driver = assignment.driver;
const writable = d => ({ DeliveryId: d.DeliveryId, DriverId: d.DriverId, Status: 'ACCEPTED', PickedUpAt: null, PickupCodeUsedAt: null });
async function issueCode(d, changes, transaction) {
  const [count] = await Deliveries.update(changes, { where: writable(d), transaction, logging: false }); return count;
}
async function failedAttempt(d, transaction) {
  const [count] = await Deliveries.update({ PickupCodeAttempts: Number(d.PickupCodeAttempts) + 1 }, {
    where: { ...writable(d), PickupCodeHash: d.PickupCodeHash, PickupCodeAttempts: d.PickupCodeAttempts }, transaction, logging: false }); return count;
}
async function pickedUp(d, changes, transaction) {
  const [count] = await Deliveries.update(changes, { where: { ...writable(d), PickupCodeHash: d.PickupCodeHash }, transaction, logging: false }); return count;
}
const history = (data, transaction) => StatusHistories.create(data, { transaction });
const notifyUser = (id, data, transaction) => notify(id, data, { transaction });
const proofIsReferenced = async key => Boolean(await Deliveries.findOne({ where: { PickupProofKey: key }, attributes: ['DeliveryId'], raw: true, logging: false }));
module.exports = { withTransaction, withSnapshot, locate, readState, actor, driver, issueCode, failedAttempt, pickedUp, history, notifyUser, proofIsReferenced };
