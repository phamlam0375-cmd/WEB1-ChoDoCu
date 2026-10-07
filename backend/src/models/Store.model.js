'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Store = sequelize.define(
    'Store',
    {
      StoreId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      OwnerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,

        references: {
          model: 'Users',
          key: 'UserId',
        },

        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      StoreName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },

      Description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      Address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      Latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      Longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      IsDemoLocation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      BankName: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },

      BankAccountNumber: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },

      BankAccountHolder: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      QrImageUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      Status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
    },
    {
      tableName: 'Stores',
      timestamps: false,
    }
);

module.exports = Store;