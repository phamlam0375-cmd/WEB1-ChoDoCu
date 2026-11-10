'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. CreditPackages — các gói mua credit
        await queryInterface.createTable('CreditPackages', {
            PackageId: {
                type: Sequelize.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            PackageName: { type: Sequelize.STRING(100), allowNull: false },
            Description: { type: Sequelize.STRING(300), allowNull: true },
            Price: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
            BaseCredit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            BonusCredit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            TotalCredit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
            IsFeatured: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            SortOrder: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
            UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
        }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' });

        // 2. UserCredits — số dư credit của từng user
        await queryInterface.createTable('UserCredits', {
            UserCreditId: {
                type: Sequelize.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            UserId: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                unique: true,
                references: { model: 'Users', key: 'UserId' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            Balance: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
        }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' });

        // 3. PromotionOrders — đơn mua gói đẩy tin bằng credit
        await queryInterface.createTable('PromotionOrders', {
            PromotionOrderId: {
                type: Sequelize.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            BuyerId: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: 'Users', key: 'UserId' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            ListingCount: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
            DurationMinutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            TotalCredit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
            IdempotencyKey: { type: Sequelize.STRING(100), allowNull: true, unique: true },
            PaidAt: { type: Sequelize.DATE, allowNull: true },
            CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
        }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' });

        await queryInterface.addIndex('PromotionOrders', ['BuyerId'], { name: 'idx_promotionorders_buyer' });
        await queryInterface.addIndex('PromotionOrders', ['Status'], { name: 'idx_promotionorders_status' });

        // 4. CreditTransactions — lịch sử giao dịch credit (nạp / tiêu / hoàn)
        await queryInterface.createTable('CreditTransactions', {
            TransactionId: {
                type: Sequelize.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            UserId: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: 'Users', key: 'UserId' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            PackageId: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: true,
                references: { model: 'CreditPackages', key: 'PackageId' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            PromotionOrderId: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: true,
                references: { model: 'PromotionOrders', key: 'PromotionOrderId' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            // Dương khi cộng (DEPOSIT, REFUND), âm khi trừ (SPEND)
            Type: { type: Sequelize.STRING(20), allowNull: false },
            Amount: { type: Sequelize.INTEGER, allowNull: false },
            BalanceAfter: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            MoneyAmount: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
            Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
            ReferenceCode: { type: Sequelize.STRING(50), allowNull: true, unique: true },
            IdempotencyKey: { type: Sequelize.STRING(100), allowNull: true },
            Note: { type: Sequelize.STRING(500), allowNull: true },
            CompletedAt: { type: Sequelize.DATE, allowNull: true },
            CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
        }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' });

        await queryInterface.addIndex('CreditTransactions', ['UserId', 'CreatedAt'], { name: 'idx_credittx_user_created' });
        await queryInterface.addIndex('CreditTransactions', ['PromotionOrderId'], { name: 'idx_credittx_promotionorder' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('CreditTransactions');
        await queryInterface.dropTable('PromotionOrders');
        await queryInterface.dropTable('UserCredits');
        await queryInterface.dropTable('CreditPackages');
    }
};
