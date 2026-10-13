const mysql = require('mysql2/promise');
const path = require('path');

// Ưu tiên đọc file .env.local nếu chạy trên máy cá nhân, nếu không sẽ dùng .env gốc của team
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'cho_do_cu',
  password: process.env.DB_PASSWORD || 'cho_do_cu_password',
  database: process.env.DB_NAME || 'cho_do_cu',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;