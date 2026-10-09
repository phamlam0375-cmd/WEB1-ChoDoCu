'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const app = require('../src/app');
const { Users } = require('../src/models');
const repository = require('../src/repositories/order.repository');

const buyer = { UserId: 315, FullName: 'D01 Demo', Phone: '0901234567', Address: 'Test', Status: 'ACTIVE', Roles: [{ RoleName: 'USER' }] };
const listing = { ListingId: 42, SellerId: 81, Title: 'Demo fixture', Price: '123456.00', Status: 'ACTIVE' };
const payload = { listingId: 42, deliveryMethod: 'PICKUP', receiverName: 'D01 Test', receiverPhone: '0901234567' };

async function fixture(t) {
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'D01_DEMO_MODE', 'D01_DEMO_USER_ID', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'false', D01_DEMO_MODE: 'true', D01_DEMO_USER_ID: '315', JWT_SECRET: 'd01-demo-unit-test-only' });
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const state = { user: structuredClone(buyer), listing: { ...listing }, orders: [], histories: [], notifications: [] };
  const lookup = t.mock.method(Users, 'findByPk', async id => { assert.equal(id, 315); return state.user; });
  t.mock.method(repository, 'findListingPreview', async id => id === 42 ? state.listing : null);
  t.mock.method(repository, 'withTransaction', async work => work({ LOCK: { UPDATE: 'UPDATE' } }));
  t.mock.method(repository, 'findListingByIdForUpdate', async () => state.listing);
  t.mock.method(repository, 'reserveListing', async () => { if (state.listing.Status !== 'ACTIVE') return 0; state.listing.Status = 'RESERVED'; return 1; });
  t.mock.method(repository, 'createOrder', async data => { const order = { ...data, OrderId: 91 }; state.orders.push(order); return order; });
  t.mock.method(repository, 'createHistory', async data => state.histories.push(data));
  t.mock.method(repository, 'createNotification', async data => state.notifications.push(data));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, headers = {}, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { state, lookup, request };
}

test('production demo preview/create dung ID backend, giu RESERVED/gia DB/history/notify', async t => {
  const { request, state } = await fixture(t);
  for (const prefix of ['/api/orders', '/api/v1/orders']) {
    const headers = { 'x-d01-demo': 'true', 'x-user-id': '2' };
    assert.equal((await request(`${prefix}/preview/42`, headers)).status, 200);
  }
  const result = await request('/api/v1/orders', { 'x-d01-demo': 'true', 'x-user-id': '2' }, payload);
  assert.equal(result.status, 201);
  assert.equal(result.body.data.status, 'RESERVED');
  assert.equal(result.body.data.totalAmount, 123456);
  assert.equal(state.orders[0].BuyerId, 315);
  assert.equal(state.listing.Status, 'RESERVED');
  assert.equal(state.histories.length, 1);
  assert.equal(state.notifications.length, 1);
  assert.equal((await request('/api/v1/orders', { 'x-d01-demo': 'true' }, payload)).status, 409);
});

test('demo off/thieu marker va production x-user-id deu khong bo qua auth', async t => {
  const { request, lookup } = await fixture(t);
  assert.equal((await request('/api/v1/orders/preview/42')).status, 401);
  assert.equal((await request('/api/v1/orders/preview/42', { 'x-user-id': '315' })).status, 401);
  process.env.D01_DEMO_MODE = 'false';
  assert.equal((await request('/api/v1/orders/preview/42', { 'x-d01-demo': 'true' })).status, 401);
  assert.equal((await request('/api/orders', { 'x-d01-demo': 'true' }, payload)).status, 401);
  assert.equal(lookup.mock.callCount(), 0);
});

test('marker demo khong mo /me/admin/refund/commission hay gia mao buyerId', async t => {
  const { request, lookup, state } = await fixture(t);
  const headers = { 'x-d01-demo': 'true', 'x-user-id': '315' };
  for (const path of ['/api/v1/me', '/api/v1/admin/users', '/api/v1/seller/commissions']) {
    assert.equal((await request(path, headers)).status, 401, path);
  }
  assert.equal((await request('/api/v1/orders/42/refund-requests', headers, {})).status, 401);
  // CD hiện NODE_ENV=development: marker vẫn không mở API của B dù có x-user-id.
  process.env.NODE_ENV = 'development';
  process.env.AUTH_DEV_HEADER = 'true';
  assert.equal((await request('/api/v1/admin/users', headers)).status, 401);
  assert.equal((await request('/api/v1/me', headers)).status, 401);
  process.env.NODE_ENV = 'production';
  process.env.AUTH_DEV_HEADER = 'false';
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal((await request('/api/v1/orders', headers, { ...payload, buyerId: 2 })).status, 422);
  state.listing.SellerId = 315;
  assert.equal((await request('/api/v1/orders', headers, payload)).status, 403);
  assert.equal(state.orders.length, 0);
});

test('tai khoan demo mat/LOCKED/ADMIN va ID sai fail closed', async t => {
  const { request, state } = await fixture(t);
  for (const user of [null, { ...buyer, Status: 'LOCKED' }, { ...buyer, Roles: [{ RoleName: 'ADMIN' }] }]) {
    state.user = user;
    const result = await request('/api/v1/orders/preview/42', { 'x-d01-demo': 'true' });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'D01_DEMO_ACCOUNT_UNAVAILABLE');
  }
  for (const id of ['', '0', 'wrong', '-1']) {
    process.env.D01_DEMO_USER_ID = id;
    const result = await request('/api/v1/orders/preview/42', { 'x-d01-demo': 'true' });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'D01_DEMO_NOT_CONFIGURED');
  }
});

test('JWT sai khong fallback demo; JWT hop le van la phien that', async t => {
  const { request, lookup } = await fixture(t);
  assert.equal((await request('/api/v1/orders/preview/42', { 'x-d01-demo': 'true', authorization: 'Bearer invalid' })).status, 401);
  assert.equal(lookup.mock.callCount(), 0);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ sub: 315, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${header}.${claims}`).digest('base64url');
  process.env.D01_DEMO_USER_ID = '999'; // Token thật không được đổi sang ID demo.
  assert.equal((await request('/api/v1/orders/preview/42', { 'x-d01-demo': 'true', authorization: `Bearer ${header}.${claims}.${signature}` })).status, 200);
  assert.equal(lookup.mock.callCount(), 1);
});
