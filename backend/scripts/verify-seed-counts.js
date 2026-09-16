'use strict';

require('dotenv').config();

const sequelize = require('../src/database');
const { TABLE_NAMES } = require('../seeders/20260916000200-seed-demo-data');

const MINIMUM_ROWS = 100001;

async function verify() {
  const results = [];
  let passed = true;

  try {
    await sequelize.authenticate();

    for (const table of TABLE_NAMES) {
      const [rows] = await sequelize.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      const total = Number(rows[0].total);
      const valid = total >= MINIMUM_ROWS;
      passed = passed && valid;
      results.push({
        table,
        rows: total,
        requirement: `>= ${MINIMUM_ROWS}`,
        result: valid ? 'PASS' : 'FAIL'
      });
    }

    console.table(results);

    if (!passed) {
      throw new Error('Có ít nhất một bảng chưa đạt 100.001 bản ghi.');
    }

    const totalRows = results.reduce((sum, item) => sum + item.rows, 0);
    console.log(`Đạt yêu cầu: ${results.length} bảng, tổng ${totalRows.toLocaleString('vi-VN')} bản ghi.`);
  } finally {
    await sequelize.close();
  }
}

verify().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
