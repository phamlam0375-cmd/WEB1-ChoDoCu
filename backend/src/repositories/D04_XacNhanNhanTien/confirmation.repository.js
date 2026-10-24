'use strict';

const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, RefundRequests, StatusHistories, Users, Listings } = require('../../models');
const { notify } = require('../../services/notification.service');

const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, work);

async function readState(id, transaction) {
  // D01/D02/D03/job và B06 cùng dùng ORDER làm mutex cho chuyển trạng thái.
  // B07 hiện khóa REFUND -> ORDER: D04 không lấy khóa refund ngược chiều.
  // D04 không khóa store hoặc đổi tin đăng.
  const order = await Orders.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  if (!order) return null;
  const payment = await Payments.findOne({ where: { OrderId: id }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  // Đây là consistent read đầu tiên sau khi đã khóa ORDER/PAYMENT, nên đọc
  // trạng thái refund đã commit tại thời điểm lấy mutex. B06 không thể tạo mới
  // refund khi D04 đang giữ ORDER; refund hiện hữu khác REJECTED luôn chặn D04.
  // Không sửa luồng/khóa B07 của thành viên B hoặc chờ refund khi đang giữ ORDER.
  const refund = await RefundRequests.findOne({ where: { OrderId: id, Status: { [Op.ne]: 'REJECTED' } }, transaction, raw: true });
  const deliveries = await sequelize.query('SELECT DeliveryId FROM Deliveries WHERE OrderId = :id FOR UPDATE', { replacements: { id }, type: QueryTypes.SELECT, transaction });
  const history = (where) => StatusHistories.findOne({ where: { OrderId: id, StatusType: 'PAYMENT', ...where }, order: [['HistoryId', 'DESC']], transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const report = await history({ StatusValue: 'REPORTED' });
  const decision = await history({ StatusValue: { [Op.in]: ['CONFIRMED', 'REJECTED'] }, Note: { [Op.like]: 'D04 %' } });
  const buyer = await Users.findByPk(order.BuyerId, { attributes: ['UserId', 'FullName'], transaction, raw: true });
  const listing = await Listings.findByPk(order.ListingId, { attributes: ['ListingId', 'Title'], transaction, raw: true });
  return { order, payment, refund, deliveries, report, decision, buyer, listing };
}

async function list(sellerId, { status, limit, offset }) {
  const result = await Orders.findAndCountAll({
    where: { SellerId: sellerId },
    attributes: ['OrderId', 'ListingId', 'BuyerId', 'Status', 'ProductAmount', 'DeliveryFee'],
    include: [
      { model: Payments, as: 'Payment', required: true, ...(status === 'ALL' ? {} : { where: { Status: status } }), attributes: ['PaymentId', 'Status', 'ReportedAt'] },
      { model: Users, as: 'Buyer', attributes: ['UserId', 'FullName'] },
      { model: Listings, as: 'Listing', attributes: ['ListingId', 'Title'] },
    ],
    order: [[{ model: Payments, as: 'Payment' }, 'ReportedAt', 'DESC'], ['OrderId', 'DESC']],
    limit, offset,
  });
  return { count: result.count, rows: result.rows.map(row => row.get({ plain: true })) };
}

async function decidePayment(payment, changes, transaction) {
  const [count] = await Payments.update(changes, { where: { PaymentId: payment.PaymentId, OrderId: payment.OrderId, Status: 'REPORTED', ProofUrl: payment.ProofUrl, ReportedAt: payment.ReportedAt }, transaction });
  return count;
}
async function markPaid(order, transaction) {
  const [count] = await Orders.update({ Status: 'PAID' }, { where: { OrderId: order.OrderId, SellerId: order.SellerId, Status: 'WAITING_PAYMENT' }, transaction });
  return count;
}
const createHistory = (data, transaction) => StatusHistories.create(data, { transaction });
const notifyBuyer = (id, data, transaction) => notify(id, data, { transaction });

module.exports = { withTransaction, readState, list, decidePayment, markPaid, createHistory, notifyBuyer };
