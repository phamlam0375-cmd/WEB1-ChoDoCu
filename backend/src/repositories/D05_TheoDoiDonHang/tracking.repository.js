'use strict';
const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, Orders, Payments, Users, Listings, ListingMedia, RefundRequests, StatusHistories, Store } = require('../../models');
const { getSettingAt } = require('../../services/settings.service');

// Một snapshot nhất quán cho tất cả SELECT, không FOR UPDATE, không ghi/prepare.
const withSnapshot = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, work);
const orderAttributes = ['OrderId', 'BuyerId', 'SellerId', 'ListingId', 'CreatedAt', 'DeliveryMethod', 'ProductAmount', 'DeliveryFee', 'TotalAmount', 'Status', 'ReservedUntil', 'CompletedAt', 'CancelReason', 'ReceiverName', 'ReceiverPhone', 'ReceiverAddress', 'BuyerNote'];
const includes = [
  { model: Users, as: 'Seller', attributes: ['UserId', 'FullName', 'Status'] },
  { model: Listings, as: 'Listing', attributes: ['ListingId', 'Title'] },
  { model: Payments, as: 'Payment', attributes: ['PaymentId', 'OrderId', 'PayerId', 'PayeeId', 'Amount', 'Status', 'ReportedAt', 'ConfirmedAt', 'ConfirmedBy', 'ProofUrl', 'BankName', 'BankAccountSnapshot', 'BankAccountHolderSnapshot', 'TransferContent'] },
];
const pageInfo = (count, options) => ({ page: options.page, limit: options.limit, total: count, totalPages: Math.max(1, Math.ceil(count / options.limit)) });
async function mediaFor(ids, transaction) {
  if (!ids.length) return new Map();
  // Một SELECT cho ảnh của cả trang, không query riêng từng đơn.
  const rows = await ListingMedia.findAll({ where: { ListingId: { [Op.in]: ids }, MediaType: 'IMAGE' }, attributes: ['ListingId', 'MediaUrl'], order: [['SortOrder', 'ASC'], ['MediaId', 'ASC']], transaction, raw: true });
  const result = new Map();
  for (const row of rows) if (!result.has(row.ListingId)) result.set(row.ListingId, row.MediaUrl);
  return result;
}
async function deliveriesFor(ids, transaction) {
  if (!ids.length) return [];
  // Deliveries có trong schema nhóm, chưa có model/API vận hành. Chỉ chọn các
  // trường công khai cần theo dõi; tuyệt đối không SELECT * hoặc lấy CodeHash.
  return sequelize.query(`SELECT d.DeliveryId, d.OrderId, d.DriverId, d.Status, d.PickupAddress, d.DeliveryAddress,
    d.DriverFee, d.RetryCount, d.FailureReason, d.AcceptedAt, d.PickedUpAt, d.DeliveredAt, d.ReturnedAt,
    u.FullName AS DriverName, u.Phone AS DriverPhone
    FROM Deliveries d LEFT JOIN Users u ON u.UserId = d.DriverId WHERE d.OrderId IN (:ids)`, { replacements: { ids }, type: QueryTypes.SELECT, transaction });
}
async function list(buyerId, options, transaction) {
  const direction = options.sort === 'oldest' ? 'ASC' : 'DESC';
  const result = await Orders.findAndCountAll({ where: { BuyerId: buyerId, ...(options.status ? { Status: options.status } : {}) }, attributes: orderAttributes, include: includes,
    order: [['CreatedAt', direction], ['OrderId', direction]], limit: options.limit, offset: options.offset, transaction });
  const rows = result.rows.map(row => row.get({ plain: true }));
  const media = await mediaFor([...new Set(rows.map(row => row.ListingId))], transaction);
  const deliveries = await deliveriesFor(rows.map(row => row.OrderId), transaction);
  return { rows: rows.map(order => ({ order, listing: order.Listing, seller: order.Seller, payment: order.Payment, image: media.get(order.ListingId) || null, deliveries: deliveries.filter(row => row.OrderId === order.OrderId) })), pagination: pageInfo(result.count, options) };
}
async function readState(id, transaction) {
  const row = await Orders.findByPk(id, { attributes: orderAttributes, include: includes, transaction });
  if (!row) return null;
  const order = row.get({ plain: true });
  const deliveries = await deliveriesFor([id], transaction);
  return { order, seller: order.Seller, listing: order.Listing, payment: order.Payment, deliveries };
}
async function readRelated(state, historyOptions, driverOnly, transaction) {
  const id = state.order.OrderId;
  const media = await mediaFor([state.order.ListingId], transaction);
  const refundRows = driverOnly ? [] : await RefundRequests.findAll({ where: { OrderId: id }, attributes: ['RefundRequestId', 'Status', 'Reason', 'Amount', 'RequestedAt', 'CompletedAt'], order: [['RequestedAt', 'DESC'], ['RefundRequestId', 'DESC']], transaction, raw: true });
  const histories = await StatusHistories.findAndCountAll({ where: { OrderId: id, ...(driverOnly ? { StatusType: { [Op.in]: ['ORDER', 'DELIVERY'] } } : {}) }, attributes: ['HistoryId', 'DeliveryId', 'StatusType', 'StatusValue', 'Note', 'CreatedAt'], order: [['CreatedAt', 'ASC'], ['HistoryId', 'ASC']], limit: historyOptions.limit, offset: historyOptions.offset, transaction, raw: true });
  const report = driverOnly ? null : await StatusHistories.findOne({ where: { OrderId: id, StatusType: 'PAYMENT', StatusValue: 'REPORTED' }, attributes: ['HistoryId'], order: [['HistoryId', 'DESC']], transaction, raw: true });
  const store = driverOnly ? null : await Store.findOne({ where: { OwnerId: state.order.SellerId }, attributes: ['Status', 'BankName', 'BankAccountNumber', 'BankAccountHolder'], transaction, raw: true });
  const refundWindowDays = !driverOnly && state.order.CompletedAt ? await getSettingAt('REFUND_WINDOW_DAYS', state.order.CreatedAt, { transaction }) : null;
  return { ...state, image: media.get(state.order.ListingId) || null, refunds: refundRows, refund: refundRows.find(row => row.Status !== 'REJECTED') || null, histories: histories.rows, historyPagination: pageInfo(histories.count, historyOptions), report, store, refundWindowDays };
}
module.exports = { withSnapshot, list, readState, readRelated };
