'use strict';

// B03: mô tả danh mục không giới hạn 300 ký tự nữa, đổi cột từ VARCHAR(300) sang MEDIUMTEXT (tối đa 16 MB)
// để quản trị dán thoải mái; mỗi lần gửi vẫn bị giới hạn 2 MB bởi express.json.
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Categories');
    if (columns.Description && !/^mediumtext$/i.test(columns.Description.type)) {
      await queryInterface.changeColumn('Categories', 'Description', { type: Sequelize.TEXT('medium'), allowNull: true });
    }
  },

  async down() {
    throw new Error('Giữ mô tả danh mục dài; đổi lại VARCHAR(300) có thể cắt mất dữ liệu.');
  },
};
