"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ConversationParticipants = sequelize.define(
    "ConversationParticipants",
    {
        // Khoa chinh ghep (ConversationId + UserId)
        ConversationId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
        UserId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
        JoinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        LastReadMessageId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        IsMuted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
        tableName: "ConversationParticipants",
        timestamps: false,
    }
);

module.exports = ConversationParticipants;