"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Commissions = sequelize.define(
  "Commissions",
  {
    CommissionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    SellerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    Rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    OriginalAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    AdjustmentAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    AmountDue: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    PaymentReference: { type: DataTypes.STRING(50), allowNull: true },
    PaymentProofUrl: { type: DataTypes.STRING(255), allowNull: true },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "UNPAID",
      validate: { isIn: [["UNPAID", "REPORTED", "PAID", "ADJUSTED", "WAIVED"]] },
    },
    DueAt: { type: DataTypes.DATE, allowNull: true },
    ConfirmedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    ConfirmedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Commissions",
    timestamps: false,
  }
);

module.exports = Commissions;
