'use strict';

// API thật từ repository làm việc, dành riêng kiểm chứng local với DB có sẵn.
// Không prepare-db/seed/migrate/job; không thay startup production src/server.js.
const path = require('node:path');
const backendRoot = path.resolve(__dirname, '..');
process.chdir(backendRoot);
require('dotenv').config();

const app = require('../src/app');
const sequelize = require('../src/database');

async function start() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Entrypoint kiểm chứng local không chạy trong production.');
  }
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');

  await sequelize.authenticate();
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  console.log(`[LocalPreview] Source: ${backendRoot}`);
  console.log(`[LocalPreview] PID: ${process.pid}; API: http://127.0.0.1:${port}`);
  console.log(`[LocalPreview] DB: ${sequelize.config.host}:${sequelize.config.port}/${sequelize.config.database} (connected)`);
  console.log('[LocalPreview] Không chạy migration, seed hoặc reservation job. Xác thực và các API thật vẫn giữ nguyên.');

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  return server;
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error(`[LocalPreview] ${error.message}`);
    await sequelize.close();
    process.exitCode = 1;
  });
}

module.exports = { start };
