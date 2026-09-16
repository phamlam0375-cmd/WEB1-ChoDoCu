require('dotenv').config();

const shared = {
  username: process.env.DB_USER || 'cho_do_cu',
  password: process.env.DB_PASSWORD || 'cho_do_cu_password',
  database: process.env.DB_NAME || 'cho_do_cu',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  dialectOptions: {
    connectTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 60000,
    idle: 10000
  }
};

module.exports = {
  development: shared,
  test: { ...shared, database: `${shared.database}_test` },
  production: shared
};
