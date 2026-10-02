'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Orders', 'DeliveryFeeRuleId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      after: 'DeliveryMethod'
    });
    await queryInterface.addColumn('Orders', 'BuyerNote', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'ReceiverAddress'
    });
    await queryInterface.addIndex('Orders', ['Status', 'ReservedUntil'], {
      name: 'orders_status_reserved_until'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Orders', 'orders_status_reserved_until');
    await queryInterface.removeColumn('Orders', 'BuyerNote');
    await queryInterface.removeColumn('Orders', 'DeliveryFeeRuleId');
  }
};
