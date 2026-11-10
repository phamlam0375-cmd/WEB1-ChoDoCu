'use strict';
const { DataTypes: D } = require('sequelize');
module.exports = require('../../database').define('DeliveryFeeRules', {
  RuleId: { type: D.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  PickupArea: { type: D.STRING(100), allowNull: false },
  DeliveryArea: { type: D.STRING(100), allowNull: false },
  VehicleType: { type: D.STRING(30), allowNull: false },
  FeeAmount: { type: D.DECIMAL(18, 2), allowNull: false },
  EstimatedMinutes: D.INTEGER,
  Status: { type: D.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
  CreatedAt: { type: D.DATE, allowNull: false, defaultValue: D.NOW },
  UpdatedAt: D.DATE,
}, { tableName: 'DeliveryFeeRules', timestamps: false });
