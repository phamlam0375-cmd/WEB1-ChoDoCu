'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { sendOtpEmail } = require('../src/services/otpMailer');

function withEnvironment(t, values) {
  const keys = ['NODE_ENV', 'OTP_DELIVERY_MODE', 'MAIL_USER', 'MAIL_PASS', 'EMAIL_USER', 'EMAIL_PASS'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);

  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('development without SMTP logs an OTP and succeeds in local flow', async (t) => {
  withEnvironment(t, { NODE_ENV: 'development' });
  const log = t.mock.method(console, 'info');

  const result = await sendOtpEmail({
    to: 'test@example.test',
    code: '123456',
    purpose: 'registration',
    subject: 'Test',
    html: '<p>Test</p>'
  });

  assert.deepEqual(result, { delivery: 'development-log' });
  assert.match(log.mock.calls[0].arguments[0], /to=test@example\.test code=123456/);
});

test('production without SMTP rejects OTP delivery', async (t) => {
  withEnvironment(t, { NODE_ENV: 'production' });

  await assert.rejects(
    sendOtpEmail({
      to: 'test@example.test',
      code: '123456',
      purpose: 'registration',
      subject: 'Test',
      html: '<p>Test</p>'
    }),
    /Thiếu MAIL_USER hoặc MAIL_PASS/
  );
});

test('development defaults to log even if stale SMTP credentials exist', async (t) => {
  withEnvironment(t, {
    NODE_ENV: 'development',
    MAIL_USER: 'old-user@example.test',
    MAIL_PASS: 'stale-password'
  });
  const log = t.mock.method(console, 'info');

  const result = await sendOtpEmail({
    to: 'test@example.test',
    code: '654321',
    purpose: 'password-reset',
    subject: 'Test',
    html: '<p>Test</p>'
  });

  assert.deepEqual(result, { delivery: 'development-log' });
  assert.match(log.mock.calls[0].arguments[0], /code=654321/);
});
