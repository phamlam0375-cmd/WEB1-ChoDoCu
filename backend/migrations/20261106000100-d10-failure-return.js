'use strict';
module.exports = {
  async up(q, S) {
    const columns = await q.describeTable('Deliveries');
    if (!columns.RetryScheduledAt) await q.addColumn('Deliveries', 'RetryScheduledAt', { type: S.DATE, allowNull: true });
    if (!columns.D10Revision) await q.addColumn('Deliveries', 'D10Revision', { type: S.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 });
    // Mở rộng dung lượng bộ đếm, không đặt chính sách số lần giao lại tối đa.
    if (!/^(?:INT|INTEGER)/i.test(columns.RetryCount.type)) await q.changeColumn('Deliveries', 'RetryCount', { type: S.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 });
    const histories = await q.describeTable('StatusHistories');
    if (!histories.D10Event) await q.addColumn('StatusHistories', 'D10Event', { type: S.JSON, allowNull: true });
  },
  async down() { throw new Error('Không tự xóa lịch giao lại và dấu kiểm soát D10; cần migration riêng bảo toàn dữ liệu.'); },
};
