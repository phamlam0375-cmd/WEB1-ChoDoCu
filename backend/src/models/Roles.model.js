"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Roles = sequelize.define(
  "Roles",
  {
    RoleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    RoleName: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },

    Description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
  {
    tableName: "Roles",
    timestamps: false,
  }
);

module.exports = Roles;