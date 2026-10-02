"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ListingMedia = sequelize.define(
  "ListingMedia",
  {
    MediaId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    MediaType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "IMAGE" },
    MediaUrl: { type: DataTypes.STRING(255), allowNull: false },
    SortOrder: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "ListingMedia",
    timestamps: false,
  }
);

module.exports = ListingMedia;
