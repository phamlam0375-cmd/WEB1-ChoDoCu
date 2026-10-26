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
  PickedUpAt: D.DATE,
  PickupCodeHash: D.STRING(255),
  PickupCodeExpiresAt: D.DATE, PickupCodeIssuedAt: D.DATE, PickupCodeUsedAt: D.DATE,
  PickupCodeAttempts: { type: D.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  SellerHandoverAt: D.DATE, SellerHandoverBy: D.INTEGER.UNSIGNED, SellerHandoverDriverId: D.INTEGER.UNSIGNED,
  PickupProofKey: D.STRING(80), PickupProofDigest: D.CHAR(64),
  ReadyForPickupAt: D.DATE, PreparedBy: D.INTEGER.UNSIGNED,
  PickupArea: D.STRING(100), DeliveryArea: D.STRING(100), VehicleType: D.STRING(30), RouteDistanceKm: D.DECIMAL(8, 2),
}, { tableName: 'Deliveries', timestamps: false,
  // D08 chọn tường minh khi cần; các caller cũ không vô tình đọc hash/bằng chứng,
  // cũng không phụ thuộc các cột mới trước khi áp dụng migration D08.
  defaultScope: { attributes: { exclude: ['PickupCodeHash', 'PickupCodeExpiresAt', 'PickupCodeIssuedAt', 'PickupCodeUsedAt', 'PickupCodeAttempts',
    'SellerHandoverAt', 'SellerHandoverBy', 'SellerHandoverDriverId', 'PickupProofKey', 'PickupProofDigest'] } },
});
