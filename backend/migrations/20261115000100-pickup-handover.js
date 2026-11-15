'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.describeTable('Orders');
    const columns = {
      PickupHandoverAt: { type: Sequelize.DATE, allowNull: true },
      PickupHandoverBy: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'Users', key: 'UserId' },
      },
    };
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing[name]) await queryInterface.addColumn('Orders', name, definition);
    }
  },

  async down() {
    throw new Error('Giữ dữ liệu bàn giao PICKUP; cần migration riêng nếu muốn hoàn tác schema.');
  },
};
