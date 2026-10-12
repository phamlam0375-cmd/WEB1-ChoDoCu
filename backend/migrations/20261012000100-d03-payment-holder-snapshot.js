'use strict';

// Không suy ra tên chủ tài khoản của giao dịch cũ từ gian hàng có thể đã đổi.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Payments', 'BankAccountHolderSnapshot', { type: Sequelize.STRING(100), allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Payments', 'BankAccountHolderSnapshot');
  },
};
