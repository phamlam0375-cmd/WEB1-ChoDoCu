'use strict';

// Khóa thuộc sự kiện lịch sử, không trộn metadata vào ghi chú người dùng.
module.exports = {
  async up(q, S) {
    const columns = await q.describeTable('StatusHistories');
    if (!columns.D09RequestId) await q.addColumn('StatusHistories', 'D09RequestId', { type: S.STRING(36), allowNull: true });
    if (!columns.D09RequestHash) await q.addColumn('StatusHistories', 'D09RequestHash', { type: S.CHAR(64), allowNull: true });
    const indexes = await q.showIndex('StatusHistories');
    if (!indexes.some(index => index.name === 'uq_d09_delivery_request')) await q.addIndex('StatusHistories', ['DeliveryId', 'D09RequestId'], { name: 'uq_d09_delivery_request', unique: true });
  },
  async down() {
    throw new Error('Không tự xóa dấu idempotency D09; cần migration riêng để bảo toàn lịch sử.');
  },
};
