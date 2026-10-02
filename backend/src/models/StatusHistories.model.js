"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const StatusHistories = sequelize.define(
  "StatusHistories",
  {
    HistoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    DeliveryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    StatusType: { type: DataTypes.STRING(20), allowNull: false },
    StatusValue: { type: DataTypes.STRING(30), allowNull: false },
    Note: { type: DataTypes.STRING(500), allowNull: true },
    ChangedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "StatusHistories",
    timestamps: false,
  }
);

module.exports = StatusHistories;
