'use strict';

module.exports = (sequelize, DataTypes) => {
    const Conversation = sequelize.define('Conversation', {
        ConversationId: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },
        ListingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        OrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        BuyerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        CreatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        ConversationType: { type: DataTypes.STRING(20), allowNull: false },
        CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        LastMessageAt: { type: DataTypes.DATE, allowNull: true }
    }, {
        tableName: 'Conversations',
        timestamps: false
    });

    Conversation.associate = (models) => {
        Conversation.belongsTo(models.Listing, { foreignKey: 'ListingId', as: 'listing' });
        Conversation.belongsTo(models.Order, { foreignKey: 'OrderId', as: 'order' });
        Conversation.belongsTo(models.User, { foreignKey: 'BuyerId', as: 'buyer' });
        Conversation.belongsTo(models.User, { foreignKey: 'CreatedBy', as: 'creator' });
        Conversation.hasMany(models.Message, { foreignKey: 'ConversationId', as: 'messages' });
        Conversation.hasMany(models.ConversationParticipant, {
            foreignKey: 'ConversationId',
            as: 'participants'
        });
    };

    return Conversation;
};