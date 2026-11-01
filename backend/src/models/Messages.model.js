"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Messages = sequelize.define(
    "Messages",
    {
        MessageId: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        ConversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        SenderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        SenderType: { type: DataTypes.STRING(15), allowNull: false },
        Content: { type: DataTypes.TEXT, allowNull: true },
        MessageType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "TEXT" },
        AttachmentUrl: { type: DataTypes.STRING(255), allowNull: true },
        IsRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        SentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
        tableName: "Messages",
        timestamps: false,
    }
);

module.exports = Messages;