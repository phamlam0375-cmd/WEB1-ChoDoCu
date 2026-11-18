'use strict';

// B03: mô tả danh mục không còn giới hạn 300 ký tự, đổi cột từ VARCHAR(300) sang TEXT.
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Categories');
    if (columns.Description && !/text/i.test(columns.Description.type)) {
      await queryInterface.changeColumn('Categories', 'Description', { type: Sequelize.TEXT, allowNull: true });
    }
  },

  async down() {
    throw new Error('Giữ mô tả danh mục dài; đổi lại VARCHAR(300) có thể cắt mất dữ liệu.');
  },
};
