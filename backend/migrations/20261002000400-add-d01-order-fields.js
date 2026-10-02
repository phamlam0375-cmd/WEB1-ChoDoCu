'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Orders');
    if (!columns.DeliveryFeeRuleId) {
      await queryInterface.addColumn('Orders', 'DeliveryFeeRuleId', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        after: 'DeliveryMethod'
      });
    }
    if (!columns.BuyerNote) {
      await queryInterface.addColumn('Orders', 'BuyerNote', {
        type: Sequelize.STRING(500),
        allowNull: true,
        after: 'ReceiverAddress'
      });
    }

    const indexes = await queryInterface.showIndex('Orders');
    if (!indexes.some((index) => index.name === 'orders_status_reserved_until')) {
      await queryInterface.addIndex('Orders', ['Status', 'ReservedUntil'], {
        name: 'orders_status_reserved_until'
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('Orders');
    if (indexes.some((index) => index.name === 'orders_status_reserved_until')) {
      await queryInterface.removeIndex('Orders', 'orders_status_reserved_until');
    }

    const columns = await queryInterface.describeTable('Orders');
    if (columns.BuyerNote) await queryInterface.removeColumn('Orders', 'BuyerNote');
    if (columns.DeliveryFeeRuleId) await queryInterface.removeColumn('Orders', 'DeliveryFeeRuleId');
  }
};
