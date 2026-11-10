'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.addIndex(
            'Reviews',
            ['OrderId', 'ReviewerId', 'TargetType'],
            { name: 'uq_reviews_order_reviewer_target', unique: true }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('Reviews', 'uq_reviews_order_reviewer_target');
    }
};
