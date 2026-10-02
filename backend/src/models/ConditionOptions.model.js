"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

// Lựa chọn tình trạng sản phẩm dùng chung cho đăng tin, tìm kiếm và bộ lọc.
// ConditionCode được lưu vào Listings.ConditionLevel nên không đổi sau khi tạo.
const ConditionOptions = sequelize.define(
  "ConditionOptions",
  {
    ConditionCode: { type: DataTypes.STRING(30), primaryKey: true, allowNull: false },
    Label: { type: DataTypes.STRING(60), allowNull: false },
    Description: { type: DataTypes.STRING(200), allowNull: true },
    SortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
      validate: { isIn: [["ACTIVE", "INACTIVE"]] },
    },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "ConditionOptions",
    timestamps: false,
  }
);

module.exports = ConditionOptions;
