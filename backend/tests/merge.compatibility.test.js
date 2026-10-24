'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const Sequelize = require('sequelize');
const models = require('../src/models');
const { requireAuth, requireTokenAuth, requireRole } = require('../src/middlewares/auth.middleware');
const { verifyToken } = require('../src/middleware/authenticate');
const AppError = require('../src/errors/AppError');
const { HttpError } = require('../src/utils/httpError');
const errorHandler = require('../src/middlewares/errorHandler');
const { createOrderService } = require('../src/services/order.service');
const { validateCreateOrder } = require('../src/validators/order.validator');
const { addMoney, asApiNumber } = require('../src/utils/money');
const earlier = require('../migrations/20261002000100-add-d01-order-fields');
const later = require('../migrations/20261002000400-add-d01-order-fields');

const SECRET = 'test-only-merge-jwt-secret-not-a-deployment-secret';
function sign(payload, secret = SECRET) {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function environment(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function authenticate(middleware, headers) {
  const req = { get: (name) => headers[name.toLowerCase()] };
  let error;
  await middleware(req, {}, (value) => { error = value; });
  return { req, error };
}

const dbUser = {
  UserId: 7, FullName: 'Fixture Buyer', Email: 'buyer@example.test',
  Phone: '0901234567', Address: 'Dia chi fixture', Status: 'ACTIVE',
  Roles: [{ RoleName: 'USER' }]
};

test('JWT va header dev deu nap ho so/role DB; JWT khong tu cap quyen ADMIN', async (t) => {
  environment(t, { NODE_ENV: 'development', AUTH_DEV_HEADER: 'true', JWT_SECRET: SECRET });
  t.mock.method(models.Users, 'findByPk', async (id) => {
    assert.equal(id, 7);
    return dbUser;
  });
  for (const headers of [
    { authorization: `Bearer ${sign({ sub: '7', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 60 })}` },
    { 'x-user-id': '7' }
  ]) {
    const { req, error } = await authenticate(requireAuth, headers);
    assert.equal(error, undefined);
    assert.equal(req.user.UserId, 7);
    assert.equal(req.user.userId, 7);
    assert.equal(req.user.Phone, dbUser.Phone);
    assert.equal(req.user.Address, dbUser.Address);
    assert.deepEqual(req.user.roles, ['USER']);
    let forbidden;
    requireRole('ADMIN')(req, {}, (value) => { forbidden = value; });
    assert.equal(forbidden.status, 403);
    let allowed;
    requireRole('USER')(req, {}, (value) => { allowed = value; });
    assert.equal(allowed, undefined);
  }
});

test('JWT sai/het han khong fallback sang header dev va khong truy van DB', async (t) => {
  environment(t, { NODE_ENV: 'development', AUTH_DEV_HEADER: 'true', JWT_SECRET: SECRET });
  const lookup = t.mock.method(models.Users, 'findByPk', async () => { throw new Error('must not query'); });
  for (const authorization of [
    'Basic invalid', 'Bearer invalid',
    `Bearer ${sign({ sub: 7 }, 'wrong-secret')}`,
    `Bearer ${sign({ sub: 7, exp: 1 })}`
  ]) {
    const { error } = await authenticate(requireAuth, { authorization, 'x-user-id': '7' });
    assert.equal(error.status, 401);
  }
  assert.equal(lookup.mock.callCount(), 0);
});

test('production va AUTH_DEV_HEADER=false cam dev, route cu luon can JWT', async (t) => {
  environment(t, { NODE_ENV: 'production', AUTH_DEV_HEADER: 'true', JWT_SECRET: SECRET });
  const lookup = t.mock.method(models.Users, 'findByPk', async () => dbUser);
  assert.equal((await authenticate(requireAuth, { 'x-user-id': '7' })).error.status, 401);
  process.env.NODE_ENV = 'development';
  process.env.AUTH_DEV_HEADER = 'false';
  assert.equal((await authenticate(requireAuth, { 'x-user-id': '7' })).error.status, 401);
  process.env.AUTH_DEV_HEADER = 'true';
  assert.equal((await authenticate(requireTokenAuth, { 'x-user-id': '7' })).error.status, 401);
  assert.equal(lookup.mock.callCount(), 0);
  process.env.NODE_ENV = 'production';
  assert.equal((await authenticate(requireAuth, { authorization: `Bearer ${sign({ sub: 7 })}` })).error, undefined);
});

test('ca JWT va dev deu tu choi tai khoan mat/bi khoa, loi DB duoc chuyen tiep', async (t) => {
  environment(t, { NODE_ENV: 'development', AUTH_DEV_HEADER: 'true', JWT_SECRET: SECRET });
  let user = null;
  let failure;
  t.mock.method(models.Users, 'findByPk', async () => {
    if (failure) throw failure;
    return user;
  });
  for (const headers of [{ 'x-user-id': '7' }, { authorization: `Bearer ${sign({ sub: 7 })}` }]) {
    user = null;
    assert.equal((await authenticate(requireAuth, headers)).error.status, 401);
    user = { ...dbUser, Status: 'LOCKED' };
    assert.equal((await authenticate(requireAuth, headers)).error.status, 403);
  }
  failure = new Error('DB unavailable');
  assert.equal((await authenticate(requireAuth, { 'x-user-id': '7' })).error, failure);
});

test('JWT HS256 ho tro sub/userId/UserId va tu choi ID khong hop le', (t) => {
  environment(t, { JWT_SECRET: SECRET });
  for (const key of ['sub', 'userId', 'UserId']) assert.equal(verifyToken(sign({ [key]: 7 })).userId, 7);
  for (const sub of [0, -1, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => verifyToken(sign({ sub })), { status: 401, code: 'INVALID_TOKEN' });
  }
});

function handle(error) {
  const response = {
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; }
  };
  errorHandler(error, { originalUrl: '/api/v1/orders' }, response, () => {});
  return response;
}

test('mot errorHandler giu envelope cu va v1, AppError la HttpError', (t) => {
  const details = { fields: { receiverName: 'required' } };
  for (const error of [
    new AppError(422, 'VALIDATION_ERROR', 'Invalid', details),
    new HttpError(422, 'Invalid', details, 'VALIDATION_ERROR')
  ]) {
    assert.ok(error instanceof HttpError);
    const result = handle(error);
    assert.equal(result.statusCode, 422);
    assert.equal(result.body.code, 'VALIDATION_ERROR');
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(result.body.errors, details);
    assert.deepEqual(result.body.error.details, details);
  }
  assert.equal(require('../src/middleware/errorHandler'), errorHandler);
  assert.equal(handle(new AppError(404, 'ROUTE_NOT_FOUND', 'Missing')).statusCode, 404);
  assert.equal(handle({ name: 'SequelizeValidationError', errors: [{ message: 'Invalid field' }] }).statusCode, 400);
  assert.equal(handle({ name: 'SequelizeUniqueConstraintError' }).statusCode, 409);
  assert.equal(handle({ type: 'entity.too.large' }).statusCode, 413);
  assert.equal(handle({ type: 'entity.parse.failed' }).statusCode, 400);
  t.mock.method(console, 'error', () => {});
  const unexpected = handle(new Error('private-db-detail'));
  assert.equal(unexpected.statusCode, 500);
  assert.equal(unexpected.body.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(unexpected.body).includes('private-db-detail'));
});

test('aliases model/controller dung chung, Orders giu fields D01 va associations B', () => {
  for (const [single, plural] of [['Order', 'Orders'], ['Listing', 'Listings'], ['Notification', 'Notifications'], ['StatusHistory', 'StatusHistories']]) {
    assert.equal(require(`../src/models/${single}.model`), models[plural]);
  }
  assert.equal(require('../src/controllers/order.controller'), require('../src/controllers/orders.controller'));
  assert.ok(models.Orders.rawAttributes.BuyerNote);
  assert.ok(models.Orders.rawAttributes.DeliveryFeeRuleId);
  for (const name of ['Buyer', 'Seller', 'Listing', 'Payment', 'Commission', 'RefundRequests']) {
    assert.ok(models.Orders.associations[name], name);
  }
});

test('preview ho tro buyerId cu va profile v1, giu check san pham cua minh', async () => {
  const service = createOrderService({
    repository: { findListingPreview: async () => ({
      ListingId: 10, SellerId: 7, Price: '123.45', Status: 'ACTIVE', SellerVerified: 1
    }) }
  });
  const legacy = await service.getOrderPreview(10, 7);
  assert.equal(legacy.listing.isOwnListing, true);
  const preview = await service.getOrderPreview(10, dbUser);
  assert.equal(preview.listing.isOwnListing, true);
  assert.equal(preview.listing.isAvailable, true);
  assert.equal(preview.listing.price, 123.45);
  assert.deepEqual(preview.buyer, { fullName: dbUser.FullName, phone: dbUser.Phone, address: dbUser.Address });
});

test('tien cong bang BigInt, gia lon khong mat xu va validation khong bi bo', () => {
  assert.equal(addMoney('0.10', '0.20'), '0.30');
  assert.equal(addMoney('9999999999999999.99', '0.01'), '10000000000000000.00');
  assert.equal(asApiNumber('9999999999999999.99'), '9999999999999999.99');
  for (const value of ['-1', '1.234', 'NaN']) assert.throws(() => addMoney(value, '0'));
  for (const payload of [null, [], 'bad']) assert.throws(() => validateCreateOrder(payload), { status: 422 });
  for (const field of ['buyerId', 'sellerId', 'productAmount', 'deliveryFee', 'totalAmount', 'commissionRate', 'status', 'reservedUntil']) {
    assert.throws(() => validateCreateOrder({ [field]: 1 }), (error) => {
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.deepEqual(error.details.fields, [field]);
      assert.ok(error.errors.fields[field]);
      return true;
    });
  }
});

test('D12 chua co: khong gia lap phi giao hang, giu endpoint v1 va ma loi 503', async () => {
  const delivery = require('../src/services/deliveryFee.service');
  assert.equal(delivery.getCapability().available, false);
  assert.equal(delivery.getCapability().estimateEndpoint, '/api/v1/delivery-fees/estimate');
  await assert.rejects(delivery.verifyQuote(), { status: 503, code: 'DELIVERY_SERVICE_UNAVAILABLE' });
});

test('repository thong bao giu transaction va timestamp voi ca hai contract', async (t) => {
  const repository = require('../src/repositories/order.repository');
  const createdAt = new Date('2026-10-02T03:00:00.000Z');
  const transaction = { fixture: true };
  const calls = [];
  t.mock.method(models.Notifications, 'create', async (data, options) => { calls.push({ data, options }); });
  await repository.createNotification({
    userId: 7, type: 'ORDER', title: 'New', message: 'Reserved',
    referenceType: 'ORDER', referenceId: 12, createdAt
  }, transaction);
  await repository.createNotification({
    UserId: 7, Type: 'ORDER', Title: 'New', Message: 'Reserved',
    ReferenceType: 'ORDER', ReferenceId: 12, CreatedAt: createdAt
  }, transaction);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].options.transaction, transaction);
  assert.equal(calls[0].data.CreatedAt, createdAt);
  assert.equal(calls[0].data.UserId, 7);
});

function schemaFixture(initial = {}) {
  const columns = { ...(initial.columns || {}) };
  const indexes = new Set(initial.indexes || []);
  const meta = new Set(initial.meta || []);
  const queryInterface = {
    describeTable: async () => ({ ...columns }),
    addColumn: async (_table, name) => { assert.ok(!columns[name], 'duplicate column'); columns[name] = true; },
    removeColumn: async (_table, name) => { assert.ok(columns[name]); delete columns[name]; },
    showIndex: async () => [...indexes].map((name) => ({ name })),
    addIndex: async (_table, _columns, { name }) => { assert.ok(!indexes.has(name)); indexes.add(name); },
    removeIndex: async (_table, name) => { assert.ok(indexes.has(name)); indexes.delete(name); },
    sequelize: { query: async (_sql, { replacements }) => [[...meta].filter((name) => name === replacements.name).map((name) => ({ name }))] }
  };
  return { columns, indexes, meta, queryInterface };
}

test('migration fresh DB va DB tung trien khai mot trong hai nhanh khong them trung', async () => {
  for (const order of [[earlier, later], [later, earlier]]) {
    const fixture = schemaFixture();
    for (const migration of order) await migration.up(fixture.queryInterface, Sequelize);
    for (const migration of order) await migration.up(fixture.queryInterface, Sequelize);
    assert.deepEqual(Object.keys(fixture.columns).sort(), ['BuyerNote', 'DeliveryFeeRuleId']);
    assert.deepEqual([...fixture.indexes], ['orders_status_reserved_until']);
  }
});

test('undo migration tuong thich khong xoa schema cua migration Lam con dang ap dung', async () => {
  const fixture = schemaFixture({ meta: ['20261002000100-add-d01-order-fields.js'] });
  await earlier.up(fixture.queryInterface, Sequelize);
  await later.up(fixture.queryInterface, Sequelize);
  await later.down(fixture.queryInterface);
  assert.ok(fixture.columns.BuyerNote);
  assert.equal(fixture.indexes.size, 1);
  await earlier.down(fixture.queryInterface);
  assert.deepEqual(fixture.columns, {});
  assert.equal(fixture.indexes.size, 0);
  const masterOnly = schemaFixture();
  await later.up(masterOnly.queryInterface, Sequelize);
  await later.down(masterOnly.queryInterface);
  assert.deepEqual(masterOnly.columns, {});
});
