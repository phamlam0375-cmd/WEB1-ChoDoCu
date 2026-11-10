'use strict';

require('dotenv').config();

const parseArgs = (args) => {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  const emailIndex = normalizedArgs.indexOf('--email');
  const email = emailIndex >= 0
    ? String(normalizedArgs[emailIndex + 1] || '').trim().toLowerCase()
    : '';
  const allowedArgs =
    emailIndex === 0 &&
    normalizedArgs.length === 3 &&
    normalizedArgs[2] === '--confirm';

  if (!allowedArgs || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      'Cách dùng: pnpm run admin:grant -- --email <email-đã-đăng-ký> --confirm',
    );
  }

  return email;
};

async function grantAdmin(email) {
  const { sequelize, Users, Roles, UserRoles } = require('../src/models');

  try {
    return await sequelize.transaction(async (transaction) => {
      const user = await Users.unscoped().findOne({
        where: { Email: email },
        attributes: ['UserId', 'Email', 'Status', 'EmailVerified'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw new Error('Không tìm thấy tài khoản. Hãy đăng ký tài khoản thật trước.');
      }
      if (!user.EmailVerified || user.Status !== 'ACTIVE') {
        throw new Error('Tài khoản phải xác minh email và đang hoạt động mới được cấp ADMIN.');
      }

      const role = await Roles.findOne({
        where: { RoleName: 'ADMIN' },
        transaction,
      });
      if (!role) {
        throw new Error('Database chưa có vai trò ADMIN. Hãy chạy migration/chuẩn bị database trước.');
      }

      const existing = await UserRoles.findOne({
        where: { UserId: user.UserId, RoleId: role.RoleId },
        transaction,
      });
      if (!existing) {
        await UserRoles.create(
          { UserId: user.UserId, RoleId: role.RoleId },
          { transaction },
        );
      }

      return { userId: user.UserId, email: user.Email, alreadyAdmin: Boolean(existing) };
    });
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  try {
    const email = parseArgs(process.argv.slice(2));
    grantAdmin(email)
      .then(({ userId, email: grantedEmail, alreadyAdmin }) => {
        console.log(
          alreadyAdmin
            ? `Tài khoản ${grantedEmail} (ID ${userId}) đã có quyền ADMIN.`
            : `Đã cấp quyền ADMIN cho tài khoản ${grantedEmail} (ID ${userId}).`,
        );
      })
      .catch((error) => {
        console.error(`Không thể cấp ADMIN: ${error.message}`);
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };
