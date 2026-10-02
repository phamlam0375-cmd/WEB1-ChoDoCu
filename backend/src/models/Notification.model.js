'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Notification = sequelize.define('Notification', {
  NotificationId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  UserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  Type: { type: DataTypes.STRING(30), allowNull: false },
  Title: { type: DataTypes.STRING(150), allowNull: false },
  Message: { type: DataTypes.STRING(500), allowNull: false },
  ReferenceType: { type: DataTypes.STRING(30), allowNull: true },
  ReferenceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  IsRead: { type: DataTypes.BOOLEAN, allowNull: false },
  CreatedAt: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'Notifications',
  timestamps: false
});

module.exports = Notification;
