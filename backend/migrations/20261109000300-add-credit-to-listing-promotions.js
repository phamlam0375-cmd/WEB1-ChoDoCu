'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const hasColumn = async (columnName) => {
            const columns = await queryInterface.describeTable('ListingPromotions');
            return Boolean(columns[columnName]);
        };

        const hasIndex = async (indexName) => {
            const indexes = await queryInterface.showIndex('ListingPromotions');
            return indexes.some((index) => index.name === indexName);
        };

        const hasConstraint = async (constraintName) => {
            const constraints = await queryInterface.getForeignKeyReferencesForTable('ListingPromotions');
            return constraints.some((constraint) => constraint.constraintName === constraintName);
        };

        // Thêm cột mới, nullable để dữ liệu cũ (thanh toán chuyển khoản) vẫn hợp lệ
        if (!(await hasColumn('PromotionOrderId'))) {
            await queryInterface.addColumn('ListingPromotions', 'PromotionOrderId', {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: true
            });
        }
        if (!(await hasColumn('CreditUsed'))) {
            await queryInterface.addColumn('ListingPromotions', 'CreditUsed', {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: true
            });
        }
        if (!(await hasColumn('DurationMinutes'))) {
            await queryInterface.addColumn('ListingPromotions', 'DurationMinutes', {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: true
            });
        }

        if (!(await hasConstraint('fk_listingpromotions_promotionorder'))) {
            await queryInterface.addConstraint('ListingPromotions', {
                fields: ['PromotionOrderId'],
                type: 'foreign key',
                name: 'fk_listingpromotions_promotionorder',
                references: { table: 'PromotionOrders', field: 'PromotionOrderId' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
        }

        // Đẩy VIP bằng Credit không có phí tiền và tên gói
        await queryInterface.changeColumn('ListingPromotions', 'FeeAmount', {
            type: Sequelize.DECIMAL(18, 2),
            allowNull: true
        });
        await queryInterface.changeColumn('ListingPromotions', 'PlanName', {
            type: Sequelize.STRING(50),
            allowNull: true
        });

        if (!(await hasIndex('idx_listingpromotions_listing_status_ends'))) {
            await queryInterface.addIndex('ListingPromotions', ['ListingId', 'Status', 'EndsAt'], {
                name: 'idx_listingpromotions_listing_status_ends'
            });
        }
        if (!(await hasIndex('idx_listingpromotions_order'))) {
            await queryInterface.addIndex('ListingPromotions', ['PromotionOrderId'], {
                name: 'idx_listingpromotions_order'
            });
        }
    },

    async down(queryInterface, Sequelize) {
        const columns = await queryInterface.describeTable('ListingPromotions');
        const indexes = await queryInterface.showIndex('ListingPromotions');
        const constraints = await queryInterface.getForeignKeyReferencesForTable('ListingPromotions');

        if (indexes.some((index) => index.name === 'idx_listingpromotions_order')) {
            await queryInterface.removeIndex('ListingPromotions', 'idx_listingpromotions_order');
        }
        if (indexes.some((index) => index.name === 'idx_listingpromotions_listing_status_ends')) {
            await queryInterface.removeIndex('ListingPromotions', 'idx_listingpromotions_listing_status_ends');
        }

        // Điền giá trị mặc định trước khi chuyển lại NOT NULL
        await queryInterface.sequelize.query(
            "UPDATE `ListingPromotions` SET `FeeAmount` = 0 WHERE `FeeAmount` IS NULL"
        );
        await queryInterface.sequelize.query(
            "UPDATE `ListingPromotions` SET `PlanName` = 'CREDIT' WHERE `PlanName` IS NULL"
        );
        await queryInterface.changeColumn('ListingPromotions', 'PlanName', {
            type: Sequelize.STRING(50),
            allowNull: false
        });
        await queryInterface.changeColumn('ListingPromotions', 'FeeAmount', {
            type: Sequelize.DECIMAL(18, 2),
            allowNull: false
        });

        if (constraints.some((constraint) => constraint.constraintName === 'fk_listingpromotions_promotionorder')) {
            await queryInterface.removeConstraint('ListingPromotions', 'fk_listingpromotions_promotionorder');
        }
        if (columns.DurationMinutes) {
            await queryInterface.removeColumn('ListingPromotions', 'DurationMinutes');
        }
        if (columns.CreditUsed) {
            await queryInterface.removeColumn('ListingPromotions', 'CreditUsed');
        }
        if (columns.PromotionOrderId) {
            await queryInterface.removeColumn('ListingPromotions', 'PromotionOrderId');
        }
    }
};