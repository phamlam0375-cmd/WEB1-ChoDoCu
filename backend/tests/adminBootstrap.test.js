'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseArgs } = require('../scripts/grant-admin-role');

test('admin:grant requires an explicit email and confirmation', () => {
  assert.equal(
    parseArgs(['--email', '  ADMIN@Example.com  ', '--confirm']),
    'admin@example.com',
  );
  assert.equal(
    parseArgs(['--', '--email', 'admin@example.com', '--confirm']),
    'admin@example.com',
  );
  assert.throws(() => parseArgs([]), /Cách dùng/);
  assert.throws(
    () => parseArgs(['--email', 'admin@example.com']),
    /Cách dùng/,
  );
  assert.throws(
    () => parseArgs(['--email', 'not-an-email', '--confirm']),
    /Cách dùng/,
  );
});
