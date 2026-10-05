'use strict';

// Chuẩn bị cơ sở dữ liệu trước khi chạy API trong Docker:
//  1. Chờ MySQL nhận kết nối.
//  2. Database hoàn toàn trống và có file backend/data/snapshot.sql (dữ liệu chung của nhóm)
//     thì nạp file đó, để máy mới có đúng dữ liệu đã xuất từ máy khác.
//  3. Chạy migration (bỏ qua các migration đã chạy).
//  4. Nếu bảng Users vẫn trống thì nạp dữ liệu mẫu (tắt bằng AUTO_SEED=false).
// Nhờ vậy máy mới chỉ cần `docker compose up -d --build` là có web đầy đủ dữ liệu.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');
const sequelize = require('../src/database');
const environments = require('../config/config');

const root = path.resolve(__dirname, '..');
const SNAPSHOT_FILE = path.join(root, 'data', 'snapshot.sql');
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

// Database "hoàn toàn trống" = chưa có bảng nào (kể cả bảng ghi migration SequelizeMeta).
async function isEmptyDatabase() {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  return Number(rows[0].total) === 0;
}

async function importSnapshot() {
  const config = environments[process.env.NODE_ENV || 'development'];
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    await connection.query(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  } finally {
    await connection.end();
  }
}

async function main() {
  await waitForDatabase();

  if (fs.existsSync(SNAPSHOT_FILE) && (await isEmptyDatabase())) {
    console.log('[prepare-db] Database trống, nạp dữ liệu chung từ backend/data/snapshot.sql...');
    await importSnapshot();
  }

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
