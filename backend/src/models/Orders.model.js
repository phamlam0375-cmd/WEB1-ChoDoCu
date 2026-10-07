"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Orders = sequelize.define(
  "Orders",
  {
    OrderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
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
    DeliveryFee: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    CommissionRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    TotalAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    Status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "RESERVED" },
    ReservedUntil: { type: DataTypes.DATE, allowNull: false },
    CancelReason: { type: DataTypes.STRING(500), allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    CompletedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Orders",
    timestamps: false,
  }
);

module.exports = Orders;
