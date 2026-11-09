'use strict';

module.exports = (sequelize, DataTypes) => {
    const PromotionOrder = sequelize.define('PromotionOrder', {
        PromotionOrderId: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        BuyerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        ListingCount: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
        DurationMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        TotalCredit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        Status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'PENDING',
            validate: { isIn: [['PENDING', 'PAID', 'FAILED', 'CANCELLED']] }
        },
        IdempotencyKey: { type: DataTypes.STRING(100), allowNull: true },
        PaidAt: { type: DataTypes.DATE, allowNull: true }
    }, {
        tableName: 'PromotionOrders',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: false
    });

    PromotionOrder.STATUS = { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED', CANCELLED: 'CANCELLED' };

    PromotionOrder.associate = (models) => {
        PromotionOrder.belongsTo(models.User, { foreignKey: 'BuyerId', as: 'buyer' });
        PromotionOrder.hasMany(models.ListingPromotion, { foreignKey: 'PromotionOrderId', as: 'items' });
        PromotionOrder.hasMany(models.CreditTransaction, { foreignKey: 'PromotionOrderId', as: 'transactions' });
    };

    return PromotionOrder;
};