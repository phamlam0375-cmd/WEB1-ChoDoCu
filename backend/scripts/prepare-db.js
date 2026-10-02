'use strict';

// Chuẩn bị cơ sở dữ liệu trước khi chạy API trong Docker:
//  1. Chờ MySQL nhận kết nối.
//  2. Chạy migration (bỏ qua các migration đã chạy).
//  3. Nếu bảng Users còn trống thì nạp dữ liệu mẫu (tắt bằng AUTO_SEED=false).
// Nhờ vậy máy mới chỉ cần `docker compose up -d --build` là có web đầy đủ dữ liệu.

require('dotenv').config();

const path = require('path');
const { execFileSync } = require('child_process');
const sequelize = require('../src/database');

const root = path.resolve(__dirname, '..');
const sequelizeCli = require.resolve('sequelize-cli/lib/sequelize');

const runCli = (...args) => {
  execFileSync(process.execPath, [sequelizeCli, ...args], { cwd: root, stdio: 'inherit' });
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase(attempts = 30) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      console.log(`[prepare-db] Chờ MySQL (${attempt}/${attempts}): ${error.message}`);
      await wait(2000);
    }
  }
  throw new Error('Không kết nối được MySQL.');
}

async function main() {
  await waitForDatabase();

  console.log('[prepare-db] Chạy migration...');
  runCli('db:migrate');

  if (process.env.AUTO_SEED === 'false') {
    console.log('[prepare-db] AUTO_SEED=false, bỏ qua dữ liệu mẫu.');
    return;
  }

  const [rows] = await sequelize.query('SELECT COUNT(*) AS total FROM `Users`');
  if (Number(rows[0].total) > 0) {
    console.log('[prepare-db] Đã có dữ liệu, không nạp lại dữ liệu mẫu.');
    return;
  }

  console.log('[prepare-db] Database trống, nạp dữ liệu mẫu...');
  runCli('db:seed:all');
}

main()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error('[prepare-db] Lỗi:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
