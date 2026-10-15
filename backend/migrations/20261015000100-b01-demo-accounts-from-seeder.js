'use strict';

// B01 — Đưa tài khoản demo của dữ liệu mẫu (seeder 15/10) lên mọi máy.
// Máy mới clone về nạp backend/data/snapshot.sql trước nên seeder không chạy; migration này
// bổ sung đúng những gì seeder đã định nghĩa, chỉ thêm khi chưa có:
// - Tài khoản quản trị admin@example.local (mật khẩu demo của seeder) với vai trò ADMIN.
// - Mật khẩu demo cho tài khoản mẫu còn dùng mật khẩu giả "demo_hash_not_for_production".
// - Vai trò Người mua (USER) cho mọi tài khoản chưa có (mặc định khi đăng ký).
// Cùng mã băm mật khẩu demo với DEMO_PASSWORD_HASH trong seeders/20260916000200-seed-demo-data.js.
const DEMO_PASSWORD_HASH = '$2b$10$b9pum1iGugwcTqiXp5nWmuq.ln/Lthh/wUNYT6PQxWRpVEOhmNY1m';

const ADMIN_EMAIL = 'admin@example.local';
const PLACEHOLDER_HASH = 'demo_hash_not_for_production';

module.exports = {
  async up(queryInterface) {
    const run = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const [[admin]] = await run('SELECT UserId FROM Users WHERE Email = :email', { email: ADMIN_EMAIL });
    if (!admin) {
      const [[taken]] = await run('SELECT UserId FROM Users WHERE UserId = 999 OR Username = :username', { username: 'admin' });
      await run(
        `INSERT INTO Users (${taken ? '' : 'UserId, '}Username, PasswordHash, FullName, Email, Phone, Address, EmailVerified, PhoneVerified, Status, CreatedAt, UpdatedAt)
         VALUES (${taken ? '' : '999, '}:username, :hash, 'Quản trị viên', :email, '0900000999', 'Việt Nam', 1, 1, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        { username: taken ? 'admin_demo' : 'admin', hash: DEMO_PASSWORD_HASH, email: ADMIN_EMAIL }
      );
    }
    await run(
      `INSERT INTO UserRoles (UserId, RoleId, AssignedAt)
       SELECT u.UserId, r.RoleId, UTC_TIMESTAMP() FROM Users u JOIN Roles r ON r.RoleName = 'ADMIN'
       WHERE u.Email = :email AND NOT EXISTS (SELECT 1 FROM UserRoles x WHERE x.UserId = u.UserId AND x.RoleId = r.RoleId)`,
      { email: ADMIN_EMAIL }
    );

    await run('UPDATE Users SET PasswordHash = :hash WHERE PasswordHash = :placeholder', {
      hash: DEMO_PASSWORD_HASH,
      placeholder: PLACEHOLDER_HASH,
    });

    await run(
      `INSERT INTO UserRoles (UserId, RoleId, AssignedAt)
       SELECT u.UserId, r.RoleId, UTC_TIMESTAMP() FROM Users u JOIN Roles r ON r.RoleName = 'USER'
       WHERE NOT EXISTS (SELECT 1 FROM UserRoles x WHERE x.UserId = u.UserId AND x.RoleId = r.RoleId)`
    );
  },

  async down() {
    // Không hoàn tác: tài khoản và vai trò có thể đã được dùng sau khi thêm.
  },
};
