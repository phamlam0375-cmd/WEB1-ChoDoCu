'use strict';
const { DataTypes: D } = require('sequelize');
const sequelize = require('../database');
// Ánh xạ bảng Deliveries chung, không sync/create bảng thứ hai.
module.exports = sequelize.define('Deliveries', {
  DeliveryId: { type: D.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  OrderId: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: true },
  DriverId: D.INTEGER.UNSIGNED,
  PickupAddress: { type: D.STRING(255), allowNull: false },
  DeliveryAddress: { type: D.STRING(255), allowNull: false },
  DriverFee: { type: D.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  Status: { type: D.STRING(20), allowNull: false, defaultValue: 'AVAILABLE' },
  AcceptedAt: D.DATE,
  ReadyForPickupAt: D.DATE, PreparedBy: D.INTEGER.UNSIGNED,
  PickupArea: D.STRING(100), DeliveryArea: D.STRING(100), VehicleType: D.STRING(30), RouteDistanceKm: D.DECIMAL(8, 2),
}, { tableName: 'Deliveries', timestamps: false });
