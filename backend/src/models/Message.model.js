'use strict';

module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define('Message', {
        MessageId: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },
        ConversationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        SenderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        SenderType: { type: DataTypes.STRING(15), allowNull: false },
        Content: { type: DataTypes.TEXT, allowNull: true },
        MessageType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'TEXT' },
        AttachmentUrl: { type: DataTypes.STRING(255), allowNull: true },
        IsRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        SentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    }, {
        tableName: 'Messages',
        timestamps: false
    });

    Message.associate = (models) => {
        Message.belongsTo(models.Conversation, { foreignKey: 'ConversationId', as: 'conversation' });
        Message.belongsTo(models.User, { foreignKey: 'SenderId', as: 'sender' });
    };

    return Message;
};