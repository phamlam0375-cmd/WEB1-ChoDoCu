'use strict';

// B05: tin bị quản trị ẩn chuyển sang SUSPENDED để người bán không tự hiện lại bằng nút ẩn/hiện (C04).
// Chỉ đổi các tin HIDDEN mà thao tác kiểm duyệt gần nhất là LISTING_HIDE.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE Listings l
       SET l.Status = 'SUSPENDED'
       WHERE l.Status = 'HIDDEN'
         AND (SELECT a.Action FROM AdminAuditLogs a
              WHERE a.TargetType = 'LISTING' AND a.TargetId = CAST(l.ListingId AS CHAR) AND a.Action LIKE 'LISTING\_%'
              ORDER BY a.CreatedAt DESC, a.LogId DESC LIMIT 1) = 'LISTING_HIDE'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`UPDATE Listings SET Status = 'HIDDEN' WHERE Status = 'SUSPENDED'`);
  },
};
