'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

module.exports = sequelize.define('Reviews', {
    ReviewId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
    OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    ReviewerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    TargetUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    TargetType: { type: DataTypes.STRING(15), allowNull: false },
    Rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    Comment: { type: DataTypes.STRING(1000), allowNull: true },
    Reply: { type: DataTypes.STRING(1000), allowNull: true },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ReplyAt: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'Reviews',
    timestamps: false
});
