'use strict';
module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    if (!tables.includes('DeliveryFeeRules')) await q.createTable('DeliveryFeeRules', {
      RuleId: { type: S.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      PickupArea: { type: S.STRING(100), allowNull: false },
      DeliveryArea: { type: S.STRING(100), allowNull: false },
      VehicleType: { type: S.STRING(30), allowNull: false },
      FeeAmount: { type: S.DECIMAL(18, 2), allowNull: false },
      EstimatedMinutes: { type: S.INTEGER, allowNull: true },
      Status: { type: S.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      CreatedAt: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
      UpdatedAt: { type: S.DATE, allowNull: true },
    });
    const indexes = await q.showIndex('DeliveryFeeRules');
    if (!indexes.some(x => x.name === 'IX_DeliveryFeeRules_Route')) await q.addIndex('DeliveryFeeRules', ['Status', 'PickupArea', 'DeliveryArea', 'VehicleType'], { name: 'IX_DeliveryFeeRules_Route' });
    if (!(await q.describeTable('Stores')).PickupArea) await q.addColumn('Stores', 'PickupArea', { type: S.STRING(100), allowNull: true });
    if (!(await q.describeTable('Orders')).DeliveryQuoteSnapshot) await q.addColumn('Orders', 'DeliveryQuoteSnapshot', { type: S.JSON, allowNull: true });
    // Không backfill khu vực, phương tiện hoặc phí cho đơn/cửa hàng cũ bằng suy đoán.
  },
  async down() { throw new Error('D12 giữ snapshot và cấu hình đã dùng; cần migration riêng nếu muốn thu hồi.'); },
};
