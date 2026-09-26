
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(
  root,
  'migrations',
  '20260916000100-create-cho-do-cu-schema.js'
);
const branchPath = path.join(
  root,
  'scripts',
  'feature-branches.txt'
);

const expectedTables = [
  'Users', 'Roles', 'UserRoles', 'VerificationCodes',
  'PartnerApplications', 'Stores', 'Categories', 'Listings',
  'ListingMedia', 'Favorites', 'ListingPromotions', 'Orders',
  'Payments', 'RefundRequests', 'Commissions', 'Deliveries',
  'StatusHistories', 'Conversations', 'Messages', 'Reviews',
  'Reports', 'Notifications'
];

const jsFiles = [
  'config/config.js',
  'src/database.js',
  'src/app.js',
  'src/server.js',
  'src/routes/health.js',
  'migrations/20260916000100-create-cho-do-cu-schema.js',
  'scripts/verify-seed-counts.js',
  'scripts/static-check.js'
];

// 1. Kiểm tra cú pháp JavaScript
for (const file of jsFiles) {
  execFileSync(
    process.execPath,
    ['--check', path.join(root, file)],
    { stdio: 'pipe' }
  );
}

// 2. Kiểm tra Migration tạo đủ 22 bảng
const migrationSource = fs.readFileSync(migrationPath, 'utf8');

for (const table of expectedTables) {
  if (!migrationSource.includes(`createTable('${table}'`)) {
    throw new Error(`Migration chưa tạo bảng ${table}.`);
  }
}

// 3. Kiểm tra đúng 40 branch tính năng
const branchLines = fs.readFileSync(branchPath, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.startsWith('#'));

if (branchLines.length !== 40) {
  throw new Error(
    `Cần đúng 40 branch tính năng, hiện có ${branchLines.length}.`
  );
}

const branches = branchLines.map((line) => line.split('|')[2]);

if (
  new Set(branches).size !== 40 ||
  branches.some((branch) => !branch.startsWith('feature/'))
) {
  throw new Error(
    'Tên branch bị trùng hoặc không theo quy ước feature/*.'
  );
}

// 4. Kết quả
console.log(`PASS: ${jsFiles.length} tệp JavaScript hợp lệ cú pháp.`);
console.log('PASS: Migration tạo đủ 22 bảng.');
console.log('PASS: Danh sách có đúng 40 branch tính năng.');