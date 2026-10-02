"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Payments = sequelize.define(
  "Payments",
  {
    PaymentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    PayerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    PayeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    Amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    BankName: { type: DataTypes.STRING(80), allowNull: true },
    BankAccountSnapshot: { type: DataTypes.STRING(30), allowNull: true },
    TransferContent: { type: DataTypes.STRING(100), allowNull: false },
    ProofUrl: { type: DataTypes.STRING(255), allowNull: true },
    Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "WAITING" },
    ReportedAt: { type: DataTypes.DATE, allowNull: true },
    ConfirmedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    ConfirmedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Payments",
    timestamps: false,
  }
);

module.exports = Payments;
