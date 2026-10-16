'use strict';

// Trường đã được định nghĩa trong tài liệu nhóm. Không backfill: DELIVERED cũ
// không tự trở thành giao hàng đã xác thực khi chưa có bằng chứng D13.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Deliveries', 'VerifiedAt', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Deliveries', 'VerifiedAt');
  },
};
