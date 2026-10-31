'use strict';
const { DataTypes: D } = require('sequelize');
const sequelize = require('../database');
module.exports = sequelize.define('DriverProfiles', {
  DriverProfileId: { type: D.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  UserId: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: true },
  VehicleType: { type: D.STRING(30), allowNull: false },
  VehiclePlate: { type: D.STRING(20), allowNull: false },
  ServiceArea: { type: D.STRING(255), allowNull: false },
  MaxDistanceKm: D.DECIMAL(6, 2),
  BankName: D.STRING(80), BankAccountNumber: D.STRING(30), BankAccountHolder: D.STRING(100), QrImageUrl: D.STRING(255),
  AvailabilityStatus: { type: D.STRING(20), allowNull: false, defaultValue: 'OFFLINE' },
  UpdatedAt: D.DATE,
}, { tableName: 'DriverProfiles', timestamps: false });
