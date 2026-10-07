'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const app = require('../src/app');
const models = require('../src/models');
const repository = require('../src/repositories/order.repository');
const errorHandler = require('../src/middlewares/errorHandler');

const SECRET = 'unit-test-only-orders-routing-secret';
const buyer = {
  UserId: 315, FullName: 'Routing Buyer', Email: 'buyer@example.test',
  Phone: '0901234567', Address: 'Dia chi test', Status: 'ACTIVE', Roles: [],
};
const listing = {
  ListingId: 1, SellerId: 81, Title: 'San pham test', Description: 'Preview',
  Price: '123456.00', ConditionLevel: 'USED_GOOD', Location: 'TP HCM', Status: 'ACTIVE',
  SellerName: 'Seller', SellerVerified: 1, ImageUrl: null,
};

function jwt() {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: buyer.UserId, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `Bearer ${header}.${payload}.${signature}`;
}

async function fixture(t) {
  const keys = ['NODE_ENV', 'AUTH_DEV_HEADER', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: 'development', AUTH_DEV_HEADER: 'true', JWT_SECRET: SECRET });
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const identityLookup = t.mock.method(models.Users, 'findByPk', async (id) => {
    assert.equal(id, buyer.UserId);
    return buyer;
  });
  const previewLookup = t.mock.method(repository, 'findListingPreview', async (id) => id === 1 ? listing : null);
  const writes = t.mock.method(repository, 'withTransaction', async () => { throw new Error('must not write in routing tests'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const request = async (path, headers = {}, payload) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, identityLookup, previewLookup, writes };
}

test('ca hai prefix giu auth truoc preview/create; JWT sai khong ha cap dev', async (t) => {
  const { request, identityLookup, previewLookup, writes } = await fixture(t);
  for (const prefix of ['/api/orders', '/api/v1/orders']) {
    assert.equal((await request(`${prefix}/preview/1`)).status, 401);
    assert.equal((await request(prefix, {}, {})).status, 401);
  }
  assert.equal((await request('/api/orders/preview/1', { 'x-user-id': String(buyer.UserId) })).status, 401);
  assert.equal((await request('/api/v1/orders/preview/1', {
    'x-user-id': String(buyer.UserId), authorization: 'Bearer invalid',
  })).status, 401);
  assert.equal(identityLookup.mock.callCount(), 0);
  assert.equal(previewLookup.mock.callCount(), 0);
  assert.equal(writes.mock.callCount(), 0);
});

test('preview JWT o hai prefix den controller/service that va tra contract frontend', async (t) => {
  const { request, previewLookup } = await fixture(t);
  for (const prefix of ['/api/orders', '/api/v1/orders']) {
    const result = await request(`${prefix}/preview/1`, { authorization: jwt() });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.listing.listingId, 1);
    assert.equal(result.body.data.listing.price, 123456);
    assert.equal(result.body.data.listing.isOwnListing, false);
    assert.equal(result.body.data.listing.isAvailable, true);
    assert.deepEqual(result.body.data.buyer, { fullName: buyer.FullName, phone: buyer.Phone, address: buyer.Address });
    assert.equal(result.body.data.delivery.available, false);
    assert.ok(result.body.data.reservationMinutes > 0);
  }
  assert.equal(previewLookup.mock.callCount(), 2);
  assert.deepEqual(previewLookup.mock.calls.map((call) => call.arguments[0]), [1, 1]);
});

test('v1 giu auth dev co dieu kien va dung ho so DB, khong gan ID 2', async (t) => {
  const { request } = await fixture(t);
  const headers = { 'x-user-id': String(buyer.UserId) };
  assert.equal((await request('/api/v1/orders/preview/1', headers)).status, 200);
  process.env.AUTH_DEV_HEADER = 'false';
  assert.equal((await request('/api/v1/orders/preview/1', headers)).status, 401);
  process.env.AUTH_DEV_HEADER = 'true';
  process.env.NODE_ENV = 'production';
  assert.equal((await request('/api/v1/orders/preview/1', headers)).status, 401);
});

test('ma tin sai la 400, tin khong ton tai la LISTING_NOT_FOUND 404 thay vi 500', async (t) => {
  const { request } = await fixture(t);
  for (const prefix of ['/api/orders', '/api/v1/orders']) {
    for (const [id, status, code] of [['not-an-id', 400, 'VALIDATION_ERROR'], ['999', 404, 'LISTING_NOT_FOUND']]) {
      const result = await request(`${prefix}/preview/${id}`, { authorization: jwt() });
      assert.equal(result.status, status);
      assert.equal(result.body.code, code);
      assert.equal(result.body.error.code, code);
    }
  }
});

test('POST hai prefix den validation that, giu route refund cua phan he B', async (t) => {
  const { request, writes } = await fixture(t);
  for (const prefix of ['/api/orders', '/api/v1/orders']) {
    const result = await request(prefix, { authorization: jwt() }, {});
    assert.equal(result.status, 422);
    assert.equal(result.body.code, 'VALIDATION_ERROR');
  }
  // Không ghi dữ liệu: auth phải chặn trước controller refund.
  assert.equal((await request('/api/v1/orders/1/refund-requests', {}, {})).status, 401);
  assert.equal(writes.mock.callCount(), 0);
});

test('route khong ton tai giu ROUTE_NOT_FOUND 404 trong app that', async (t) => {
  const { request } = await fixture(t);
  const result = await request('/api/v1/not-a-route');
  assert.equal(result.status, 404);
  assert.equal(result.body.code, 'ROUTE_NOT_FOUND');
  assert.equal(result.body.error.code, 'ROUTE_NOT_FOUND');
});

test('AppError extends Error cu giu status/details; loi khong xac dinh van 500', (t) => {
  class LegacyAppError extends Error {
    constructor(status) {
      super('Business error');
      this.name = 'AppError'; this.status = status; this.code = 'BUSINESS_ERROR';
      this.details = { fields: { receiverName: 'required' } };
    }
  }
  function handle(error) {
    const res = {
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    errorHandler(error, { originalUrl: '/api/v1/orders/preview/1' }, res, () => {});
    return res;
  }
  for (const status of [400, 401, 403, 404, 409, 422, 503]) {
    const result = handle(new LegacyAppError(status));
    assert.equal(result.statusCode, status);
    assert.equal(result.body.code, 'BUSINESS_ERROR');
    assert.deepEqual(result.body.errors, result.body.error.details);
  }
  t.mock.method(console, 'error', () => {});
  const unknown = new Error('private detail'); unknown.status = 404;
  assert.equal(handle(unknown).statusCode, 500);
  assert.equal(handle(new LegacyAppError(200)).statusCode, 500);
  assert.ok(!JSON.stringify(handle(unknown).body).includes('private detail'));
});
