"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const UserRoles = sequelize.define(
  "UserRoles",
  {
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "Users",
        key: "UserId",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    RoleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "Roles",
        key: "RoleId",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    AssignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "UserRoles",
    timestamps: false,
  }
);

module.exports = UserRoles;