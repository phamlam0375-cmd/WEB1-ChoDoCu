'use strict';
module.exports = {
  async up(q, S) {
    const columns = {
      CompletionCodeHash: { type: S.STRING(255), allowNull: true },
      CompletionCodeExpiresAt: { type: S.DATE, allowNull: true },
      CompletionCodeIssuedAt: { type: S.DATE, allowNull: true },
      CompletionCodeUsedAt: { type: S.DATE, allowNull: true },
      CompletionCodeSession: { type: S.CHAR(36), allowNull: true },
      CompletionCodeDriverId: { type: S.INTEGER.UNSIGNED, allowNull: true },
      CompletionCodeRunRevision: { type: S.INTEGER.UNSIGNED, allowNull: true },
      CompletionCodeAttempts: { type: S.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      CompletionIssueWindowAt: { type: S.DATE, allowNull: true },
      CompletionIssueCount: { type: S.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      CompletionProofKey: { type: S.STRING(80), allowNull: true },
      CompletionProofDigest: { type: S.CHAR(64), allowNull: true },
      DeliveredAt: { type: S.DATE, allowNull: true }, VerifiedAt: { type: S.DATE, allowNull: true },
    };
    const existing = await q.describeTable('Deliveries');
    for (const [name, definition] of Object.entries(columns)) if (!existing[name]) await q.addColumn('Deliveries', name, definition);
    // Không backfill xác thực cho chuyến cũ chỉ vì đang có chuỗi DELIVERED.
  },
  async down() { throw new Error('D13 giữ mã băm và bằng chứng đã dùng; cần migration riêng nếu thu hồi.'); },
};
