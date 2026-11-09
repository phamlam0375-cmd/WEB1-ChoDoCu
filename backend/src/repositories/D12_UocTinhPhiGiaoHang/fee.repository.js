'use strict';
const { sequelize, Listings, Store, Users, DeliveryFeeRules } = require('../../models');
const { Transaction } = require('sequelize');
module.exports = {
  withTransaction: work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, work),
  listing: (id, transaction) => Listings.findByPk(id, { transaction, raw: true }),
  user: (id, transaction) => Users.findByPk(id, { attributes: ['UserId', 'Status'], transaction, raw: true }),
  pickup: (listing, transaction, lock = false) => Store.findOne({ where: { ...(listing.StoreId ? { StoreId: listing.StoreId } : {}), OwnerId: listing.SellerId }, transaction, raw: true, ...(lock ? { lock: transaction.LOCK.SHARE } : {}) }),
  rules: (transaction, lock = false) => DeliveryFeeRules.findAll({ where: { Status: 'ACTIVE' }, order: [['RuleId', 'ASC']], transaction, raw: true, ...(lock ? { lock: transaction.LOCK.SHARE } : {}) }),
};
