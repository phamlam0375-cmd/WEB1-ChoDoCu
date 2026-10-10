'use strict';

const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, Listings, Orders, Payments, StatusHistories } = require('../models');
const { notify } = require('../services/notification.service');

async function withTransaction(work) {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    work
  );
}

async function findListingByIdForUpdate(listingId, transaction) {
  return Listings.findByPk(listingId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
    raw: true
  });
}

async function findListingPreview(listingId, transaction) {
  const rows = await sequelize.query(
    `SELECT
       l.ListingId, l.SellerId, l.Title, l.Description, l.Price,
       l.ConditionLevel, l.Location, l.Status,
       u.FullName AS SellerName,
       (u.EmailVerified = 1 OR u.PhoneVerified = 1) AS SellerVerified,
       (SELECT lm.MediaUrl FROM ListingMedia lm
        WHERE lm.ListingId = l.ListingId AND lm.MediaType = 'IMAGE'
        ORDER BY lm.SortOrder ASC, lm.MediaId ASC LIMIT 1) AS ImageUrl
     FROM Listings l
     INNER JOIN Users u ON u.UserId = l.SellerId
     WHERE l.ListingId = :listingId
     LIMIT 1`,
    { replacements: { listingId }, type: QueryTypes.SELECT, transaction }
  );
  return rows[0] || null;
}

async function reserveListing(listingId, transaction) {
  const [affectedCount] = await Listings.update(
    { Status: 'RESERVED', UpdatedAt: new Date() },
    { where: { ListingId: listingId, Status: 'ACTIVE' }, transaction }
  );
  return affectedCount;
}

async function createOrder(data, transaction) {
  return Orders.create(data, { transaction });
}

async function createHistory(data, transaction) {
  return StatusHistories.create(data, { transaction });
}

async function createNotification(data, transaction) {
  // Chấp nhận cả contract D01 cũ và service thông báo dùng chung.
  return notify(data.userId ?? data.UserId, {
    type: data.type ?? data.Type,
    title: data.title ?? data.Title,
    message: data.message ?? data.Message,
    referenceType: data.referenceType ?? data.ReferenceType,
    referenceId: data.referenceId ?? data.ReferenceId,
    createdAt: data.createdAt ?? data.CreatedAt
  }, { transaction });
}

async function findExpiredReservations(now, limit, transaction) {
  return sequelize.query(
    `SELECT OrderId, BuyerId, SellerId, ListingId
     FROM Orders
     WHERE Status = 'RESERVED' AND ReservedUntil <= :now
     ORDER BY ReservedUntil ASC, OrderId ASC
     LIMIT :limit
     FOR UPDATE SKIP LOCKED`,
    { replacements: { now, limit }, type: QueryTypes.SELECT, transaction }
  );
}

async function cancelExpiredOrder(orderId, now, reason, transaction) {
  // ORDER đã được khóa bởi findExpiredReservations. Không coi REPORTED là chưa trả;
  // khóa payment/delivery để job không giải phóng món trong lúc xác minh/giao nhận.
  const payment = await Payments.findOne({ where: { OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  if (payment && !['WAITING', 'REJECTED'].includes(payment.Status)) return 0;
  const deliveries = await sequelize.query('SELECT DeliveryId FROM Deliveries WHERE OrderId = :orderId FOR UPDATE', {
    replacements: { orderId }, type: QueryTypes.SELECT, transaction
  });
  if (deliveries.length) return 0;
  const [affectedCount] = await Orders.update(
    { Status: 'CANCELLED', CancelReason: reason },
    {
      where: {
        OrderId: orderId,
        Status: 'RESERVED',
        ReservedUntil: { [Op.lte]: now }
      },
      transaction
    }
  );
  return affectedCount;
}

async function reopenListing(listingId, transaction) {
  // Khóa tin rồi đọc hiện tại, không dùng snapshot cũ. Bảo vệ cả D01 hết hạn và D02.
  const listing = await findListingByIdForUpdate(listingId, transaction);
  if (!listing || listing.Status !== 'RESERVED') return 0;
  const blockers = await sequelize.query(
    `SELECT o.OrderId FROM Orders o
     WHERE o.ListingId = :listingId AND (
       o.Status NOT IN ('CANCELLED', 'REFUNDED')
       OR EXISTS (SELECT 1 FROM Payments p WHERE p.OrderId = o.OrderId AND p.Status NOT IN ('WAITING', 'REJECTED') AND o.Status <> 'REFUNDED')
       OR EXISTS (SELECT 1 FROM Deliveries d WHERE d.OrderId = o.OrderId AND (d.Status <> 'RETURNED' OR d.ReturnedAt IS NULL))
     ) FOR UPDATE`,
    { replacements: { listingId }, type: QueryTypes.SELECT, transaction }
  );
  if (blockers.length) return 0;
  const [affectedCount] = await Listings.update({ Status: 'ACTIVE', UpdatedAt: new Date() }, {
    where: { ListingId: listingId, Status: 'RESERVED' }, transaction
  });
  return affectedCount;
}

module.exports = {
  cancelExpiredOrder,
  createHistory,
  createNotification,
  createOrder,
  findExpiredReservations,
  findListingByIdForUpdate,
  findListingPreview,
  reopenListing,
  reserveListing,
  withTransaction
};
