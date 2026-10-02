"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Categories = sequelize.define(
  "Categories",
  {
    CategoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    CategoryName: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    Description: { type: DataTypes.STRING(300), allowNull: true },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
      validate: { isIn: [["ACTIVE", "INACTIVE"]] },
    },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "Categories",
    timestamps: false,
  }
);

module.exports = Categories;
