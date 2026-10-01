"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const RefundRequests = sequelize.define(
  "RefundRequests",
  {
    RefundRequestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    RequestedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    Reason: { type: DataTypes.STRING(500), allowNull: false },
    EvidenceUrl: { type: DataTypes.STRING(255), allowNull: true },
    Amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    RefundProofUrl: { type: DataTypes.STRING(255), allowNull: true },
    Status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "PENDING",
      validate: {
        isIn: [["PENDING", "APPROVED", "REJECTED", "SELLER_TRANSFERRED", "COMPLETED"]],
      },
    },
    AdminNote: { type: DataTypes.STRING(500), allowNull: true },
    ReviewedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    RequestedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ReviewedAt: { type: DataTypes.DATE, allowNull: true },
    CompletedAt: { type: DataTypes.DATE, allowNull: true },
    OrderStatusBefore: { type: DataTypes.STRING(30), allowNull: true },
  },
  {
    tableName: "RefundRequests",
    timestamps: false,
  }
);

module.exports = RefundRequests;
