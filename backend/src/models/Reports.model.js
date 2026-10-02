"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Reports = sequelize.define(
  "Reports",
  {
    ReportId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    ReporterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    ReportedUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    Reason: { type: DataTypes.STRING(200), allowNull: false },
    Description: { type: DataTypes.STRING(1000), allowNull: true },
    EvidenceUrl: { type: DataTypes.STRING(255), allowNull: true },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDING",
      validate: { isIn: [["PENDING", "PROCESSING", "RESOLVED", "REJECTED"]] },
    },
    HandledBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    Resolution: { type: DataTypes.STRING(1000), allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    HandledAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Reports",
    timestamps: false,
  }
);

module.exports = Reports;
