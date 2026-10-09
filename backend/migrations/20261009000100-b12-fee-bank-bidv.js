'use strict';

// B12 — Tài khoản nhận phí của website dùng chung cho cả nhóm: BIDV 5811768917, chủ tài khoản CHO DO CU.
// Mỗi máy chạy migration này một lần khi khởi động (sau khi nạp snapshot), nên máy nào cũng có cùng tài khoản.

const NEW_VALUES = {
  FEE_BANK_CODE: '970418',
  FEE_BANK_ACCOUNT_NUMBER: '5811768917',
  FEE_BANK_ACCOUNT_HOLDER: 'CHO DO CU',
};

const OLD_VALUES = {
  FEE_BANK_CODE: '970436',
  FEE_BANK_ACCOUNT_NUMBER: '0123456789',
  FEE_BANK_ACCOUNT_HOLDER: 'CHO DO CU',
};

async function apply(queryInterface, values) {
  for (const [key, value] of Object.entries(values)) {
    await queryInterface.sequelize.query(
      `INSERT INTO SystemSettings (SettingKey, SettingValue, UpdatedAt)
       VALUES (:key, :value, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue), UpdatedAt = VALUES(UpdatedAt)`,
      { replacements: { key, value } }
    );
  }
}

module.exports = {
  async up(queryInterface) {
    await apply(queryInterface, NEW_VALUES);
  },

  async down(queryInterface) {
    await apply(queryInterface, OLD_VALUES);
  },
};
