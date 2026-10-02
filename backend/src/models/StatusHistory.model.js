'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const StatusHistory = sequelize.define('StatusHistory', {
  HistoryId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  DeliveryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  StatusType: { type: DataTypes.STRING(20), allowNull: false },
  StatusValue: { type: DataTypes.STRING(30), allowNull: false },
  Note: { type: DataTypes.STRING(500), allowNull: true },
  ChangedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  CreatedAt: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'StatusHistories',
  timestamps: false
});

module.exports = StatusHistory;
