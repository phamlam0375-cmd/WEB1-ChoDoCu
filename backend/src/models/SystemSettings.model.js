"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const SystemSettings = sequelize.define(
  "SystemSettings",
  {
    SettingKey: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false },
    SettingValue: { type: DataTypes.STRING(255), allowNull: false },
    UpdatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    UpdatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "SystemSettings",
    timestamps: false,
  }
);

module.exports = SystemSettings;
