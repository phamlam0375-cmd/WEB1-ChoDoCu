'use strict';

const { Op, QueryTypes, Transaction } = require('sequelize');
const sequelize = require('../database');
const Listing = require('../models/Listing.model');
const Notification = require('../models/Notification.model');
const Order = require('../models/Order.model');
const StatusHistory = require('../models/StatusHistory.model');

async function withTransaction(work) {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    work
  );
}

async function findListingByIdForUpdate(listingId, transaction) {
  return Listing.findByPk(listingId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
    raw: true
  });
}

async function findListingPreview(listingId) {
  const rows = await sequelize.query(
    `SELECT
       l.ListingId,
       l.SellerId,
       l.Title,
       l.Description,
       l.Price,
       l.ConditionLevel,
       l.Location,
       l.Status,
       u.FullName AS SellerName,
       (u.EmailVerified = 1 OR u.PhoneVerified = 1) AS SellerVerified,
       (
         SELECT lm.MediaUrl
         FROM ListingMedia lm
         WHERE lm.ListingId = l.ListingId AND lm.MediaType = 'IMAGE'
         ORDER BY lm.SortOrder ASC, lm.MediaId ASC
         LIMIT 1
       ) AS ImageUrl
     FROM Listings l
     INNER JOIN Users u ON u.UserId = l.SellerId
     WHERE l.ListingId = :listingId
     LIMIT 1`,
    {
      replacements: { listingId },
      type: QueryTypes.SELECT
    }
  );

  return rows[0] || null;
}

async function reserveListing(listingId, transaction) {
  const [affectedCount] = await Listing.update(
    { Status: 'RESERVED', UpdatedAt: new Date() },
    { where: { ListingId: listingId, Status: 'ACTIVE' }, transaction }
  );
  return affectedCount;
}

async function createOrder(data, transaction) {
  return Order.create(data, { transaction });
}

async function createHistory(data, transaction) {
  return StatusHistory.create(data, { transaction });
}

async function createNotification(data, transaction) {
  return Notification.create(data, { transaction });
}

async function findExpiredReservations(now, limit, transaction) {
  return sequelize.query(
    `SELECT OrderId, BuyerId, SellerId, ListingId
     FROM Orders
     WHERE Status = 'RESERVED' AND ReservedUntil <= :now
     ORDER BY ReservedUntil ASC, OrderId ASC
     LIMIT :limit
     FOR UPDATE SKIP LOCKED`,
    {
      replacements: { now, limit },
      type: QueryTypes.SELECT,
      transaction
    }
  );
}

async function cancelExpiredOrder(orderId, now, reason, transaction) {
  const [affectedCount] = await Order.update(
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
  const [affectedCount] = await Listing.update(
    { Status: 'ACTIVE', UpdatedAt: new Date() },
    { where: { ListingId: listingId, Status: 'RESERVED' }, transaction }
  );
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
