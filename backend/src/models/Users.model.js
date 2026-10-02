"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Users = sequelize.define(
  "Users",
  {
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    Username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    PasswordHash: { type: DataTypes.STRING(255), allowNull: true },
    FullName: { type: DataTypes.STRING(100), allowNull: false },
    Email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    Phone: { type: DataTypes.STRING(15), allowNull: true, unique: true },
    GoogleId: { type: DataTypes.STRING(150), allowNull: true, unique: true },
    AvatarUrl: { type: DataTypes.STRING(255), allowNull: true },
    Address: { type: DataTypes.STRING(255), allowNull: true },
    EmailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    PhoneVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
      validate: { isIn: [["ACTIVE", "LOCKED"]] },
    },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    UpdatedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Users",
    timestamps: false,
    // Không bao giờ trả mật khẩu băm ra API.
    defaultScope: {
      attributes: { exclude: ["PasswordHash"] },
    },
  }
);

module.exports = Users;
