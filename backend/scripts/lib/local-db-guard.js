'use strict';
const assert = require('node:assert/strict');
async function verifyLocalDatabase(sequelize, { allowTest = false } = {}) {
  assert.equal(process.env.LOCAL_DATA_MAINTENANCE, 'true', 'Explicit local maintenance opt-in required');
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.equal(sequelize.config.host, '127.0.0.1');
  assert.equal(Number(sequelize.config.port), 33307);
  assert(process.env.EXPECTED_LOCAL_DB_UUID, 'Supply the UUID verified from the local Compose volume');
  const [[identity]] = await sequelize.query('SELECT DATABASE() AS db, @@server_uuid AS uuid');
  assert.equal(identity.uuid, process.env.EXPECTED_LOCAL_DB_UUID);
  assert(identity.db === 'cho_do_cu' || (allowTest && /^cho_do_cu_[a-z0-9_]+_test$/.test(identity.db)), 'Local demo/test database only');
  return identity;
}
module.exports = { verifyLocalDatabase };
