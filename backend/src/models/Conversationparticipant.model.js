'use strict';

module.exports = (sequelize, DataTypes) => {
    const ConversationParticipant = sequelize.define('ConversationParticipant', {
        // Khoa chinh ghep (ConversationId + UserId)
        ConversationId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
        UserId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
        JoinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        LastReadMessageId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        IsMuted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, {
        tableName: 'ConversationParticipants',
        timestamps: false
    });

    ConversationParticipant.associate = (models) => {
        ConversationParticipant.belongsTo(models.Conversation, { foreignKey: 'ConversationId', as: 'conversation' });
        ConversationParticipant.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });
        ConversationParticipant.belongsTo(models.Message, { foreignKey: 'LastReadMessageId', as: 'lastReadMessage' });
    };

    return ConversationParticipant;
};