"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ListingPromotions = sequelize.define(
  "ListingPromotions",
  {
    PromotionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    SellerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    PlanName: { type: DataTypes.STRING(50), allowNull: false },
    FeeAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    PaymentReference: { type: DataTypes.STRING(50), allowNull: true },
    PaymentProofUrl: { type: DataTypes.STRING(255), allowNull: true },
    Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" },
    StartsAt: { type: DataTypes.DATE, allowNull: true },
    EndsAt: { type: DataTypes.DATE, allowNull: true },
    ConfirmedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    ConfirmedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "ListingPromotions",
    timestamps: false,
  }
);

module.exports = ListingPromotions;
