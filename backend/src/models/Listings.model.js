"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Listings = sequelize.define(
  "Listings",
  {
    ListingId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    SellerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    StoreId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    CategoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    Title: { type: DataTypes.STRING(180), allowNull: false },
    Description: { type: DataTypes.TEXT, allowNull: false },
    Price: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    ConditionLevel: { type: DataTypes.STRING(30), allowNull: false },
    KnownDefects: { type: DataTypes.TEXT, allowNull: true },
    Location: { type: DataTypes.STRING(255), allowNull: true },
    Status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" },
    ModerationNote: { type: DataTypes.STRING(500), allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    UpdatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Listings",
    timestamps: false,
  }
);

module.exports = Listings;
