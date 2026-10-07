'use strict';

// Đồng bộ ngày giờ mua bán của dữ liệu mẫu với thời điểm hiện tại.
// Đơn mới nhất dời về lúc chạy script, mỗi đơn trước đó lùi một ngày. Mọi mốc thời gian
// liên quan của từng đơn (thanh toán, hoa hồng, hoàn tiền, giao hàng, đánh giá, báo cáo,
// lịch sử trạng thái) dời cùng một khoảng nên thứ tự trước sau giữ nguyên.
// Chỉ dời đơn tạo trước hôm nay; thao tác thật trong hôm nay giữ nguyên giờ.
// Chạy: docker compose exec api node scripts/sync-demo-dates.js

require('dotenv').config();
const sequelize = require('../src/database');

// Cột "hạn" (luôn dời theo đơn) và cột "sự kiện" (chỉ dời nếu xảy ra trước hôm nay).
const TABLES = [
  { table: 'Orders', deadlines: ['ReservedUntil'], events: ['CreatedAt', 'CompletedAt'] },
  { table: 'Payments', deadlines: [], events: ['ReportedAt', 'ConfirmedAt'] },
  { table: 'Commissions', deadlines: ['DueAt'], events: ['ReportedAt', 'ConfirmedAt'] },
  { table: 'RefundRequests', deadlines: [], events: ['RequestedAt', 'ReviewedAt', 'SellerRespondedAt', 'CompletedAt'] },
  { table: 'StatusHistories', deadlines: [], events: ['CreatedAt'] },
  { table: 'Deliveries', deadlines: [], events: ['AcceptedAt', 'PickedUpAt', 'DeliveredAt', 'ReturnedAt'] },
  { table: 'Reviews', deadlines: [], events: ['CreatedAt', 'ReplyAt'] },
  { table: 'Reports', deadlines: [], events: ['CreatedAt', 'HandledAt'] },
  { table: 'Conversations', deadlines: [], events: ['CreatedAt', 'LastMessageAt'] },
];

async function main() {
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });

    // Đầu ngày hôm nay theo giờ Việt Nam, quy ra UTC (giờ lưu trong DB).
    await run("SET @cutoff = CONVERT_TZ(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')), '+07:00', '+00:00')");
    await run('DROP TEMPORARY TABLE IF EXISTS order_shift');
    await run(`
      CREATE TEMPORARY TABLE order_shift AS
      SELECT OrderId,
             TIMESTAMPDIFF(SECOND, CreatedAt, UTC_TIMESTAMP() - INTERVAL 10 MINUTE - INTERVAL (rn - 1) DAY) AS delta
      FROM (SELECT OrderId, CreatedAt, ROW_NUMBER() OVER (ORDER BY CreatedAt DESC, OrderId DESC) AS rn
            FROM Orders WHERE CreatedAt < @cutoff) ranked`);

    const [[{ total }]] = await run('SELECT COUNT(*) AS total FROM order_shift');
    for (const { table, deadlines, events } of TABLES) {
      const sets = [
        ...deadlines.map((column) => `t.\`${column}\` = t.\`${column}\` + INTERVAL s.delta SECOND`),
        ...events.map(
          (column) => `t.\`${column}\` = IF(t.\`${column}\` < @cutoff, t.\`${column}\` + INTERVAL s.delta SECOND, t.\`${column}\`)`
        ),
      ];
      const [result] = await run(`UPDATE \`${table}\` t JOIN order_shift s ON s.OrderId = t.OrderId SET ${sets.join(', ')}`);
      console.log(`${table}: ${result.affectedRows ?? result.changedRows ?? 0} dòng`);
    }
    await run('DROP TEMPORARY TABLE order_shift');
    console.log(`Đã đồng bộ ngày giờ của ${total} đơn với thời điểm hiện tại.`);
  });
  await sequelize.close();
}

main().catch(async (error) => {
  console.error('Không đồng bộ được ngày giờ:', error.message);
  await sequelize.close();
  process.exitCode = 1;
});
