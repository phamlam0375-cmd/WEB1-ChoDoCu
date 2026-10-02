'use strict';

// Phân hệ B: nhật ký thao tác quản trị (B11) và cấu hình quy tắc hệ thống (B12).

const TABLE_OPTIONS = {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB'
};

const DEFAULT_SETTINGS = [
  ['COMMISSION_RATE', '5'],
  ['COMMISSION_DUE_DAYS', '7'],
  ['SELLER_DEBT_LIMIT', '5000000'],
  ['REFUND_WINDOW_DAYS', '7'],
  ['FEE_BANK_NAME', 'Vietcombank'],
  ['FEE_BANK_ACCOUNT_NUMBER', '0123456789'],
  ['FEE_BANK_ACCOUNT_HOLDER', 'CHO DO CU']
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AdminAuditLogs', {
      LogId: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      AdminId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'Users', key: 'UserId' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      Action: { type: Sequelize.STRING(50), allowNull: false },
      TargetType: { type: Sequelize.STRING(30), allowNull: false },
      TargetId: { type: Sequelize.STRING(64), allowNull: true },
      OldValue: { type: Sequelize.TEXT, allowNull: true },
      NewValue: { type: Sequelize.TEXT, allowNull: true },
      Note: { type: Sequelize.STRING(500), allowNull: true },
      IpAddress: { type: Sequelize.STRING(45), allowNull: true },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, TABLE_OPTIONS);

    await queryInterface.addIndex('AdminAuditLogs', ['CreatedAt']);
    await queryInterface.addIndex('AdminAuditLogs', ['AdminId', 'CreatedAt']);
    await queryInterface.addIndex('AdminAuditLogs', ['Action', 'CreatedAt']);
    await queryInterface.addIndex('AdminAuditLogs', ['TargetType', 'TargetId']);

    await queryInterface.createTable('SystemSettings', {
      SettingKey: { type: Sequelize.STRING(50), primaryKey: true, allowNull: false },
      SettingValue: { type: Sequelize.STRING(255), allowNull: false },
      UpdatedBy: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'Users', key: 'UserId' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      UpdatedAt: { type: Sequelize.DATE, allowNull: true }
    }, TABLE_OPTIONS);

    await queryInterface.bulkInsert(
      'SystemSettings',
      DEFAULT_SETTINGS.map(([SettingKey, SettingValue]) => ({ SettingKey, SettingValue }))
    );

    // B06/B07: nhớ trạng thái đơn trước khi chuyển sang REFUND_PENDING để khôi phục khi từ chối.
    await queryInterface.addColumn('RefundRequests', 'OrderStatusBefore', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
    await queryInterface.addIndex('Reports', ['Status', 'CreatedAt']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Reports', ['Status', 'CreatedAt']);
    await queryInterface.removeColumn('RefundRequests', 'OrderStatusBefore');
    await queryInterface.dropTable('SystemSettings');
    await queryInterface.dropTable('AdminAuditLogs');
  }
};
