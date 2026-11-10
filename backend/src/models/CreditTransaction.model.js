'use strict';

module.exports = (sequelize, DataTypes) => {
    const CreditTransaction = sequelize.define('CreditTransaction', {
        TransactionId: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        UserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        PackageId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        PromotionOrderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        Type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [['DEPOSIT', 'SPEND', 'REFUND']] }
        },
        // Dương khi cộng (DEPOSIT, REFUND), âm khi trừ (SPEND)
        Amount: { type: DataTypes.INTEGER, allowNull: false },
        BalanceAfter: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        MoneyAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
        Status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'PENDING',
            validate: { isIn: [['PENDING', 'SUCCESS', 'FAILED']] }
        },
        ReferenceCode: { type: DataTypes.STRING(50), allowNull: true, unique: true },
        IdempotencyKey: { type: DataTypes.STRING(100), allowNull: true },
        Note: { type: DataTypes.STRING(500), allowNull: true },
        CompletedAt: { type: DataTypes.DATE, allowNull: true }
    }, {
        tableName: 'CreditTransactions',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: false
    });

    CreditTransaction.TYPE = { DEPOSIT: 'DEPOSIT', SPEND: 'SPEND', REFUND: 'REFUND' };
    CreditTransaction.STATUS = { PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED' };

    CreditTransaction.associate = (models) => {
        CreditTransaction.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });
        CreditTransaction.belongsTo(models.CreditPackage, { foreignKey: 'PackageId', as: 'package' });
        CreditTransaction.belongsTo(models.PromotionOrder, { foreignKey: 'PromotionOrderId', as: 'promotionOrder' });
    };

    return CreditTransaction;
};