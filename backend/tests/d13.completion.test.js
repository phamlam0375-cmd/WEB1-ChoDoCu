'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const v = require('../src/validators/D13_XacThucGiaoHangOTP/completion.validator');
const { codePolicy } = require('../src/services/D13_XacThucGiaoHangOTP/completion.service');
const { verifiedDelivery } = require('../src/services/D13_XacThucGiaoHangOTP/verification.policy');
const { pngReceipt } = require('./D03_ThanhToan/fixtures');
const now = new Date('2026-11-09T08:00:00Z');
const body = { completionCode: '001234', codeSession: randomUUID(), handoverConfirmed: true };
test('D13 strict whitelist, leading zero and handover boolean; rejects forged identities/paths', () => {
  assert.equal(v.complete(body).completionCode, '001234');
  for (const completionCode of [1234, '1234', ' 001234', '１２３４５６', '001234x']) assert.throws(() => v.complete({ ...body, completionCode }), { status: 400 });
  for (const handoverConfirmed of [false, 'true', 1, null]) assert.throws(() => v.complete({ ...body, handoverConfirmed }), { code: 'COMPLETION_PROOF_REQUIRED' });
  for (const key of ['DriverId', 'Status', 'ProofUrl', 'VerifiedAt', 'OrderId', 'proofKey']) assert.throws(() => v.complete({ ...body, [key]: 'fake' }), { status: 400 });
  assert.throws(() => v.issue({ code: '123456' })); assert.throws(() => v.key('old-id'));
});
test('D13 actual JPG/PNG bytes required, not a client filename/MIME/path', () => {
  const buffer = pngReceipt(); assert.equal(v.image({ buffer, size: buffer.length, mimetype: 'image/png' }), 'png');
  assert.throws(() => v.image(null), { code: 'COMPLETION_PROOF_REQUIRED' });
  for (const file of [{ buffer: Buffer.from('fake'), size: 4, mimetype: 'image/png' }, { buffer, size: buffer.length, mimetype: 'image/jpeg' }, { buffer: Buffer.alloc(6 * 1024 * 1024), mimetype: 'image/png' }]) assert.throws(() => v.image(file), { code: 'INVALID_COMPLETION_PROOF' });
});
test('D13 sessions bound to current driver/run, expires at boundary; attempts durable policy', () => {
  const d = { DriverId: 13, D10Revision: 2, CompletionCodeRunRevision: 2, CompletionCodeDriverId: 13, CompletionCodeHash: 'bcrypt', CompletionCodeSession: body.codeSession, CompletionCodeIssuedAt: new Date(+now - 1000), CompletionCodeExpiresAt: new Date(+now + 1000), CompletionCodeAttempts: 0 };
  assert.equal(codePolicy(d, now).allowed, true);
  for (const change of [{ CompletionCodeRunRevision: 1 }, { DriverId: 14 }, { CompletionCodeUsedAt: now }, { CompletionCodeSession: null }, { CompletionCodeExpiresAt: now }, { CompletionCodeIssuedAt: new Date(+now + 1) }]) assert.equal(codePolicy({ ...d, ...change }, now).allowed, false);
  assert.equal(codePolicy({ ...d, CompletionCodeAttempts: 5 }, now).code, 'COMPLETION_CODE_LOCKED');
});
test('D06 requires actual D13 purpose proof and ledger, legacy DELIVERED/ProofUrl insufficient', () => {
  const d = { Status: 'DELIVERED', DriverId: 13, CompletionCodeDriverId: 13, CompletionCodeSession: body.codeSession, CompletionCodeIssuedAt: new Date(+now - 1000), CompletionCodeUsedAt: now, CompletionCodeExpiresAt: new Date(+now + 1000), VerifiedAt: now, DeliveredAt: now, CompletionProofKey: `d13-${randomUUID()}.png`, CompletionProofDigest: 'a'.repeat(64), HasD13Event: true, CompletionProofAvailable: true };
  assert.equal(verifiedDelivery(d, now), true);
  for (const change of [{ HasD13Event: false }, { CompletionProofAvailable: false }, { CompletionProofKey: `d08-${randomUUID()}.png` }, { ReturnedAt: now }, { CompletionCodeUsedAt: null }, { DriverId: 99 }]) assert.equal(verifiedDelivery({ ...d, ...change }, now), false);
  assert.equal(verifiedDelivery({ Status: 'DELIVERED', VerifiedAt: now, DeliveredAt: now, ProofUrl: '/legacy.png' }, now), false);
});

test('D13 routes require real JWT in development/production even with dev/demo enabled, before multipart parsing', async t => {
  const express = require('express'), router = require('../src/routes/D13_XacThucGiaoHangOTP/completion.route');
  const app = express(); app.use('/api/v1', router); app.use((e, _req, res, _next) => res.status(e.status || 500).json({ code: e.code }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const previous = { NODE_ENV: process.env.NODE_ENV, AUTH_DEV_HEADER: process.env.AUTH_DEV_HEADER, D01_DEMO_MODE: process.env.D01_DEMO_MODE };
  t.after(() => { server.closeAllConnections(); server.close(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  for (const mode of ['development', 'production']) {
    process.env.NODE_ENV = mode; process.env.AUTH_DEV_HEADER = 'true'; process.env.D01_DEMO_MODE = 'true';
    for (const [method, path] of [['GET', '/orders/1/delivery-code'], ['POST', '/orders/1/delivery-code'], ['GET', '/driver/deliveries/2/complete-preview'], ['PATCH', '/driver/deliveries/2/complete'], ['GET', '/orders/1/deliveries/2/completion-proof']]) {
      for (const headers of [{}, { 'x-user-id': '2' }, { 'x-d01-demo': 'true' }, { Authorization: 'Bearer invalid' }]) {
        const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, { method, headers: { ...headers, 'content-type': 'multipart/form-data; boundary=invalid' }, ...(method === 'PATCH' || method === 'POST' ? { body: 'invalid multipart' } : {}) });
        assert.equal(r.status, 401); assert.match(r.headers.get('cache-control'), /no-store/);
      }
    }
  }
});
