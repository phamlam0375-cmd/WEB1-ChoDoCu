"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Conversations = sequelize.define(
    "Conversations",
    {
        ConversationId: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        BuyerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        CreatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        ConversationType: { type: DataTypes.STRING(20), allowNull: false },
        CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        LastMessageAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
        tableName: "Conversations",
        timestamps: false,
    }
);

module.exports = Conversations;