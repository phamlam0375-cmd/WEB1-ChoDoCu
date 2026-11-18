'use strict';

// B03: mỗi danh mục có thể gắn một ảnh (đường dẫn ảnh tải lên qua /uploads hoặc link http(s)).
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Categories');
    if (!columns.ImageUrl) {
      await queryInterface.addColumn('Categories', 'ImageUrl', { type: Sequelize.STRING(255), allowNull: true, after: 'Description' });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Categories', 'ImageUrl');
  },
};
