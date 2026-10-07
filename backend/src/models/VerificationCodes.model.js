const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const VerificationCodes = sequelize.define(
  "VerificationCodes",
  {
    VerificationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },

    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    Recipient: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    Channel: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    Purpose: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    CodeHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    ExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    UsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "VerificationCodes",
    timestamps: false,
  }
);

module.exports = VerificationCodes;