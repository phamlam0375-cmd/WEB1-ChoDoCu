"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Notifications = sequelize.define(
  "Notifications",
  {
    NotificationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    UserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    Type: { type: DataTypes.STRING(30), allowNull: false },
    Title: { type: DataTypes.STRING(150), allowNull: false },
    Message: { type: DataTypes.STRING(500), allowNull: false },
    ReferenceType: { type: DataTypes.STRING(30), allowNull: true },
    ReferenceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    IsRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "Notifications",
    timestamps: false,
  }
);

module.exports = Notifications;
