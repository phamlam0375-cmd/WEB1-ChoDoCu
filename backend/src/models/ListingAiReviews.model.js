"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

// B05 — Kết quả AI sàng lọc tin đăng. Reasons, Flags lưu dạng chuỗi JSON.
const ListingAiReviews = sequelize.define(
  "ListingAiReviews",
  {
    ListingId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, allowNull: false },
    Recommendation: { type: DataTypes.STRING(10), allowNull: false },
    RiskLevel: { type: DataTypes.STRING(10), allowNull: false },
    Summary: { type: DataTypes.STRING(500), allowNull: false },
    Reasons: { type: DataTypes.TEXT, allowNull: false },
    Flags: { type: DataTypes.TEXT, allowNull: false },
    Model: { type: DataTypes.STRING(60), allowNull: false },
    ReviewedAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: "ListingAiReviews", timestamps: false }
);

module.exports = ListingAiReviews;
