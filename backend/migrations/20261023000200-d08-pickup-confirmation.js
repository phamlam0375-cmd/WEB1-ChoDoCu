'use strict';

// PickupCodeHash/PickedUpAt đã có trong schema chung. Không dùng lại mã D13,
// không điền dấu bàn giao hoặc tạo mã cho dữ liệu cũ.
module.exports = {
  async up(q, S) {
    const columns = {
      PickupCodeExpiresAt: { type: S.DATE, allowNull: true },
      PickupCodeIssuedAt: { type: S.DATE, allowNull: true },
      PickupCodeUsedAt: { type: S.DATE, allowNull: true },
      PickupCodeAttempts: { type: S.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      SellerHandoverAt: { type: S.DATE, allowNull: true },
      SellerHandoverBy: { type: S.INTEGER.UNSIGNED, allowNull: true, references: { model: 'Users', key: 'UserId' } },
      SellerHandoverDriverId: { type: S.INTEGER.UNSIGNED, allowNull: true, references: { model: 'Users', key: 'UserId' } },
      PickupProofKey: { type: S.STRING(80), allowNull: true },
      PickupProofDigest: { type: S.CHAR(64), allowNull: true },
    };
    // MySQL DDL auto-commit: tiếp tục an toàn nếu lần chạy trước bị ngắt giữa chừng.
    const existing = await q.describeTable('Deliveries');
    for (const [name, definition] of Object.entries(columns)) if (!existing[name]) await q.addColumn('Deliveries', name, definition);
  },
  async down() {
    throw new Error('D08 giữ dấu xác thực và bằng chứng: cần migration riêng nếu muốn hoàn tác schema.');
  },
};
