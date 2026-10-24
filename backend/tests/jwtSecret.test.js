'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getJwtSecret } = require('../src/utils/jwtSecret');

test('development uses the shared local-only JWT secret when none is configured', (t) => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'development';
  delete process.env.JWT_SECRET;

  t.after(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  assert.equal(getJwtSecret(), 'cho-do-cu-local-development-only-jwt-secret');
});

test('production requires a configured JWT secret', (t) => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;

  t.after(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  assert.throws(getJwtSecret, /Thiếu JWT_SECRET/);
});
