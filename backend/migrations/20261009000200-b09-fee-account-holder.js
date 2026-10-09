'use strict';

// Tên chủ tài khoản nhận phí khớp với ảnh mã VietQR BIDV dùng ở trang thanh toán (áp dụng cho mọi máy).

const setHolder = (queryInterface, value) =>
  queryInterface.sequelize.query(
    `INSERT INTO SystemSettings (SettingKey, SettingValue, UpdatedAt)
     VALUES ('FEE_BANK_ACCOUNT_HOLDER', :value, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue), UpdatedAt = VALUES(UpdatedAt)`,
    { replacements: { value } }
  );

module.exports = {
  async up(queryInterface) {
    await setHolder(queryInterface, 'NGUYEN DUY TUNG');
  },

  async down(queryInterface) {
    await setHolder(queryInterface, 'CHO DO CU');
  },
};
