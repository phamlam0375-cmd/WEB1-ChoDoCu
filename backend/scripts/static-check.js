'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '20260916000100-create-cho-do-cu-schema.js');
const seederPath = path.join(root, 'seeders', '20260916000200-seed-demo-data.js');
const branchPath = path.join(root, 'scripts', 'feature-branches.txt');
const expectedTables = [
  'Users', 'Roles', 'UserRoles', 'VerificationCodes', 'PartnerApplications',
  'Stores', 'Categories', 'Listings', 'ListingMedia', 'Favorites',
  'ListingPromotions', 'Orders', 'Payments', 'RefundRequests', 'Commissions',
  'Deliveries', 'StatusHistories', 'Conversations', 'Messages', 'Reviews',
  'Reports', 'Notifications'
];

const jsFiles = [
  'config/config.js',
  'src/database.js',
  'src/app.js',
  'src/server.js',
  'src/routes/health.js',
  'migrations/20260916000100-create-cho-do-cu-schema.js',
  'seeders/20260916000200-seed-demo-data.js',
  'scripts/verify-seed-counts.js',
  'scripts/static-check.js'
];

for (const file of jsFiles) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
}

const migrationSource = fs.readFileSync(migrationPath, 'utf8');
for (const table of expectedTables) {
  if (!migrationSource.includes(`createTable('${table}'`)) {
    throw new Error(`Migration chưa tạo bảng ${table}.`);
  }
}

const seeder = require(seederPath);
if (seeder.ROWS_PER_TABLE < 100001) {
  throw new Error('Seeder chưa bảo đảm trên 100.000 dòng mỗi bảng.');
}
if (JSON.stringify(seeder.TABLE_NAMES) !== JSON.stringify(expectedTables)) {
  throw new Error('Danh sách bảng trong seeder không khớp migration.');
}

const branchLines = fs.readFileSync(branchPath, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.startsWith('#'));
if (branchLines.length !== 40) {
  throw new Error(`Cần đúng 40 branch tính năng, hiện có ${branchLines.length}.`);
}

const branches = branchLines.map((line) => line.split('|')[2]);
if (new Set(branches).size !== 40 || branches.some((branch) => !branch.startsWith('feature/'))) {
  throw new Error('Tên branch bị trùng hoặc không theo quy ước feature/*.');
}

console.log('PASS: 9 tệp JavaScript hợp lệ cú pháp.');
console.log('PASS: Migration tạo đủ 22 bảng.');
console.log(`PASS: Seeder bảo đảm ${seeder.ROWS_PER_TABLE} dòng/bảng.`);
console.log('PASS: Danh sách có đúng 40 branch tính năng.');
