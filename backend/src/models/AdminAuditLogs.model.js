"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

// B11: nhật ký chỉ được ghi thêm. Chặn sửa/xóa ngay ở model để không ai chỉnh
// được dấu vết, kể cả khi lỡ viết code gọi update/destroy.
const readOnlyError = () => {
  throw new Error("Nhật ký thao tác quản trị chỉ được ghi thêm, không được sửa hoặc xóa.");
};

const AdminAuditLogs = sequelize.define(
  "AdminAuditLogs",
  {
    LogId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    AdminId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    Action: { type: DataTypes.STRING(50), allowNull: false },
    TargetType: { type: DataTypes.STRING(30), allowNull: false },
    TargetId: { type: DataTypes.STRING(64), allowNull: true },
    OldValue: { type: DataTypes.TEXT, allowNull: true },
    NewValue: { type: DataTypes.TEXT, allowNull: true },
    Note: { type: DataTypes.STRING(500), allowNull: true },
    IpAddress: { type: DataTypes.STRING(45), allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "AdminAuditLogs",
    timestamps: false,
    hooks: {
      beforeUpdate: readOnlyError,
      beforeBulkUpdate: readOnlyError,
      beforeDestroy: readOnlyError,
      beforeBulkDestroy: readOnlyError,
      beforeUpsert: readOnlyError,
    },
  }
);

module.exports = AdminAuditLogs;
