'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Order = sequelize.define('Order', {
  OrderId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  BuyerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  SellerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  DeliveryMethod: { type: DataTypes.STRING(20), allowNull: false },
  DeliveryFeeRuleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  ReceiverName: { type: DataTypes.STRING(100), allowNull: false },
  ReceiverPhone: { type: DataTypes.STRING(15), allowNull: false },
  ReceiverAddress: { type: DataTypes.STRING(255), allowNull: true },
  BuyerNote: { type: DataTypes.STRING(500), allowNull: true },
  ProductAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  DeliveryFee: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  CommissionRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  TotalAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  Status: { type: DataTypes.STRING(30), allowNull: false },
  ReservedUntil: { type: DataTypes.DATE, allowNull: false },
  CancelReason: { type: DataTypes.STRING(500), allowNull: true },
  CreatedAt: { type: DataTypes.DATE, allowNull: false },
  CompletedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'Orders',
  timestamps: false
});

module.exports = Order;
