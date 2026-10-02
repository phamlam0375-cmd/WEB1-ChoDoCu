'use strict';

// Phân hệ B — bổ sung theo bản báo cáo chi tiết:
// - Tên danh mục so sánh không phân biệt hoa thường nhưng PHÂN BIỆT dấu ("Bàn" khác "Bán").
// - Bảng ConditionOptions: lựa chọn tình trạng sản phẩm do quản trị chỉnh sửa.
// - Hoàn tiền: mô tả, phản hồi người bán, tài khoản nhận hoàn của người mua, mã giao dịch.
// - Hoa hồng: mã giao dịch người bán nhập khi báo đã nộp.
// - Cấu hình: phí tin VIP, thời gian giữ món; tài khoản nhận phí lưu theo mã ngân hàng (VietQR).

const TABLE_OPTIONS = {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB'
};

const DEFAULT_CONDITIONS = [
  ['NEW', 'Mới', 'Chưa qua sử dụng, còn nguyên hộp hoặc tem.', 1],
  ['LIKE_NEW', 'Như mới', 'Gần như chưa sử dụng, không trầy xước.', 2],
  ['GOOD', 'Đã qua sử dụng - tốt', 'Có dấu hiệu sử dụng nhẹ, hoạt động bình thường.', 3],
  ['FAIR', 'Đã qua sử dụng - khá', 'Trầy xước hoặc hao mòn thấy rõ, vẫn dùng được.', 4],
  ['POOR', 'Cũ nhiều', 'Hư hỏng một phần, cần sửa chữa hoặc lấy linh kiện.', 5]
];

const REFUND_COLUMNS = {
  Description: (Sequelize) => ({ type: Sequelize.STRING(1000), allowNull: true }),
  SellerResponse: (Sequelize) => ({ type: Sequelize.STRING(1000), allowNull: true }),
  SellerRespondedAt: (Sequelize) => ({ type: Sequelize.DATE, allowNull: true }),
  RefundBankCode: (Sequelize) => ({ type: Sequelize.STRING(10), allowNull: true }),
  RefundAccountNumber: (Sequelize) => ({ type: Sequelize.STRING(30), allowNull: true }),
  RefundAccountHolder: (Sequelize) => ({ type: Sequelize.STRING(100), allowNull: true }),
  RefundTransactionCode: (Sequelize) => ({ type: Sequelize.STRING(50), allowNull: true })
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE `Categories` MODIFY `CategoryName` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL'
    );

    await queryInterface.createTable('ConditionOptions', {
      ConditionCode: { type: Sequelize.STRING(30), primaryKey: true, allowNull: false },
      Label: { type: Sequelize.STRING(60), allowNull: false },
      Description: { type: Sequelize.STRING(200), allowNull: true },
      SortOrder: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      Status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, TABLE_OPTIONS);
    await queryInterface.sequelize.query(
      'ALTER TABLE `ConditionOptions` MODIFY `Label` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL'
    );
    await queryInterface.bulkInsert(
      'ConditionOptions',
      DEFAULT_CONDITIONS.map(([ConditionCode, Label, Description, SortOrder]) => ({
        ConditionCode, Label, Description, SortOrder, Status: 'ACTIVE'
      }))
    );

    for (const [column, definition] of Object.entries(REFUND_COLUMNS)) {
      await queryInterface.addColumn('RefundRequests', column, definition(Sequelize));
    }

    await queryInterface.addColumn('Commissions', 'PaymentTransactionCode', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('Commissions', 'ReportedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.bulkDelete('SystemSettings', { SettingKey: 'FEE_BANK_NAME' });
    await queryInterface.bulkInsert('SystemSettings', [
      { SettingKey: 'FEE_BANK_CODE', SettingValue: '970436' },
      { SettingKey: 'VIP_FEE', SettingValue: '40000' },
      { SettingKey: 'RESERVATION_HOURS', SettingValue: '24' }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('SystemSettings', {
      SettingKey: ['FEE_BANK_CODE', 'VIP_FEE', 'RESERVATION_HOURS']
    });
    await queryInterface.bulkInsert('SystemSettings', [
      { SettingKey: 'FEE_BANK_NAME', SettingValue: 'Vietcombank' }
    ]);
    await queryInterface.removeColumn('Commissions', 'ReportedAt');
    await queryInterface.removeColumn('Commissions', 'PaymentTransactionCode');
    for (const column of Object.keys(REFUND_COLUMNS).reverse()) {
      await queryInterface.removeColumn('RefundRequests', column);
    }
    await queryInterface.dropTable('ConditionOptions');
    await queryInterface.sequelize.query(
      'ALTER TABLE `Categories` MODIFY `CategoryName` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
    );
  }
};
