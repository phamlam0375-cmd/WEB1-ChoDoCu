'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../src/app');
const { Users } = require('../src/models');

test('D01–D05 yêu cầu JWT cả development/production; mọi header/query/payload giả không cấp phiên', async t => {
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { AUTH_DEV_HEADER: 'true', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '1', JWT_SECRET: 'auth-unit-only' });
  const lookup = t.mock.method(Users, 'findByPk', async () => assert.fail('Guest must not reach DB identity lookup'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const routes = [['GET', '/api/orders/preview/1'], ['POST', '/api/orders'], ['GET', '/api/v1/orders/preview/1'], ['POST', '/api/v1/orders'], ['GET', '/api/v1/orders/1/cancellation-preview'], ['PATCH', '/api/v1/orders/1/cancel'], ['GET', '/api/v1/orders/1/payment-info'], ['POST', '/api/v1/orders/1/payment-notice'], ['GET', '/api/v1/orders'], ['GET', '/api/v1/orders/1/tracking'], ['GET', '/api/v1/seller/orders/payments'], ['GET', '/api/v1/seller/orders/1/payment'], ['PATCH', '/api/v1/seller/orders/1/payment']];
  const expired = () => { const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url'); const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 1, exp: 1 })}`; return data + '.' + crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url'); };
  for (process.env.NODE_ENV of ['development', 'production']) {
    for (const [method, path] of routes) for (const authorization of [null, 'Bearer invalid', `Bearer ${expired()}`]) {
      const headers = { 'x-user-id': '1', 'x-d01-demo': 'true', 'content-type': 'application/json', ...(authorization ? { authorization } : {}) };
      const res = await fetch(`http://127.0.0.1:${server.address().port}${path}?u=1&BuyerId=1`, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify({ BuyerId: 1, SellerId: 1, UserId: 1, ChangedBy: 1 }) }) });
      assert.equal(res.status, 401, `${process.env.NODE_ENV} ${method} ${path}`);
    }
  }
  assert.equal(lookup.mock.callCount(), 0);
});
