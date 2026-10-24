'use strict';

require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.env.NODE_ENV === 'production') throw new Error('Không chạy fixture trên production.');
// Chỉ cấu hình tiến trình test riêng; không sửa .env/server đang chạy.
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
process.env.AUTH_DEV_HEADER = 'true';
const app = require('../src/app');
const { QueryTypes } = require('sequelize');
const { sequelize, Categories, Listings, Notifications, Orders, StatusHistories, Users } = require('../src/models');
const repository = require('../src/repositories/order.repository');
const { createOrderService } = require('../src/services/order.service');

function tokenFor(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId), exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function request(baseUrl, path, headers = {}, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  let server;
  let fixture;
  const suffix = `${Date.now()}-${process.pid}`;
  try {
    await sequelize.authenticate();
    // Setup nguyên tử, ID auto-increment bình thường; không seed/reset dữ liệu.
    fixture = await sequelize.transaction(async (transaction) => {
      const users = [];
      for (const name of ['seller', 'buyer-a', 'buyer-b']) {
        users.push(await Users.create({
          Username: `d01-${name}-${suffix}`, FullName: `D01 ${name}`,
          Email: `d01-${name}-${suffix}@example.test`,
          Address: 'Dia chi fixture D01', Status: 'ACTIVE'
        }, { transaction }));
      }
      const category = await Categories.create({
        CategoryName: `D01 concurrency ${suffix}`, Status: 'ACTIVE'
      }, { transaction });
      const listings = [];
      for (let i = 0; i < 3; i += 1) {
        listings.push(await Listings.create({
          SellerId: users[0].UserId, CategoryId: category.CategoryId,
          Title: `D01 concurrency ${i}`, Description: 'Fixture tam, tu dong don dep',
          Price: '1234567.00', ConditionLevel: 'USED_GOOD',
          Location: 'TP. Ho Chi Minh', Status: 'ACTIVE'
        }, { transaction }));
      }
      return { users, category, listings };
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve); server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const [seller, buyerA, buyerB] = fixture.users;
    const jwt = (user) => ({ authorization: `Bearer ${tokenFor(user.UserId)}` });
    const dev = (user) => ({ 'x-user-id': String(user.UserId) });
    const payload = (listing) => ({
      listingId: listing.ListingId, deliveryMethod: 'PICKUP',
      receiverName: 'Nguoi mua thu nghiem', receiverPhone: '0901234567', note: 'Kiem tra tranh dat trung'
    });
    for (const path of ['/api/orders', '/api/v1/orders']) {
      const anonymous = await request(baseUrl, path, {}, payload(fixture.listings[0]));
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.body.code, 'UNAUTHORIZED');
      assert.equal(anonymous.body.error.code, 'UNAUTHORIZED');
      assert.equal((await request(baseUrl, path, jwt(seller), payload(fixture.listings[0]))).status, 403);
      const preview = await request(baseUrl, `${path}/preview/${fixture.listings[0].ListingId}`, jwt(buyerA));
      assert.equal(preview.status, 200);
      assert.equal(preview.body.data.buyer.fullName, buyerA.FullName);
      assert.equal(preview.body.data.buyer.address, buyerA.Address);
    }
    assert.equal((await request(baseUrl, '/api/orders', dev(buyerA), payload(fixture.listings[0]))).status, 401);
    assert.equal((await request(baseUrl, '/api/v1/me', jwt(buyerA))).status, 200);
    assert.equal((await request(baseUrl, '/api/v1/me', dev(buyerA))).status, 200);
    assert.equal((await request(baseUrl, '/api/v1/admin/users', jwt(buyerA))).status, 403);
    assert.equal((await request(baseUrl, '/api/v1/categories')).status, 200);
    assert.equal((await request(baseUrl, '/api/v1/me', { ...dev(buyerA), authorization: 'Bearer invalid' })).status, 401);
    const missing = await request(baseUrl, '/api/not-a-route');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'ROUTE_NOT_FOUND');

    const cases = [
      [['/api/orders', jwt(buyerA)], ['/api/orders', jwt(buyerB)]],
      [['/api/v1/orders', dev(buyerA)], ['/api/v1/orders', dev(buyerB)]],
      [['/api/orders', jwt(buyerA)], ['/api/v1/orders', dev(buyerB)]]
    ];
    const results = [];
    for (let i = 0; i < cases.length; i += 1) {
      const listing = fixture.listings[i];
      const responses = await Promise.all(cases[i].map(([path, headers]) => request(baseUrl, path, headers, payload(listing))));
      const statuses = responses.map((r) => r.status).sort();
      assert.deepEqual(statuses, [201, 409]);
      const rejected = responses.find((r) => r.status === 409);
      assert.equal(rejected.body.code, 'LISTING_UNAVAILABLE');
      assert.equal(rejected.body.error.code, 'LISTING_UNAVAILABLE');
      const orders = await Orders.findAll({ where: { ListingId: listing.ListingId }, raw: true });
      assert.equal(orders.length, 1);
      assert.equal(orders[0].Status, 'RESERVED');
      assert.equal(String(orders[0].ProductAmount), '1234567.00');
      assert.equal(String(orders[0].TotalAmount), '1234567.00');
      const orderId = orders[0].OrderId;
      assert.equal(await StatusHistories.count({ where: { OrderId: orderId, StatusValue: 'RESERVED' } }), 1);
      assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: orderId } }), 1);
      assert.equal((await Listings.findByPk(listing.ListingId)).Status, 'RESERVED');
      results.push({ routes: cases[i].map(([path]) => path), statuses });
    }
    // Job chỉ nhìn thấy đơn fixture, không được quét/hủy đơn có sẵn.
    const listingIds = fixture.listings.map((listing) => listing.ListingId);
    const orders = await Orders.findAll({ where: { ListingId: listingIds }, raw: true });
    const afterExpiry = new Date(Math.max(...orders.map((order) => new Date(order.ReservedUntil).getTime())) + 1000);
    const scopedRepository = {
      ...repository,
      findExpiredReservations: (now, limit, transaction) => sequelize.query(
        `SELECT OrderId, BuyerId, SellerId, ListingId FROM Orders
         WHERE ListingId IN (:listingIds) AND Status = 'RESERVED' AND ReservedUntil <= :now
         ORDER BY ReservedUntil, OrderId LIMIT :limit FOR UPDATE SKIP LOCKED`,
        { replacements: { listingIds, now, limit }, type: QueryTypes.SELECT, transaction }
      )
    };
    const service = createOrderService({ repository: scopedRepository, clock: () => afterExpiry });
    const expiration = await Promise.all([service.expireReservations(), service.expireReservations()]);
    assert.equal(expiration.reduce((total, item) => total + item.expiredCount, 0), 3);
    assert.deepEqual(await service.expireReservations(), { expiredCount: 0 });
    for (const order of orders) {
      assert.equal((await Orders.findByPk(order.OrderId)).Status, 'CANCELLED');
      assert.equal((await Listings.findByPk(order.ListingId)).Status, 'ACTIVE');
      assert.equal(await StatusHistories.count({ where: { OrderId: order.OrderId, StatusValue: 'CANCELLED' } }), 1);
      assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: order.OrderId } }), 3);
    }
    console.log(JSON.stringify({ ok: true, races: results, expiration, fixtureOnly: true }, null, 2));
  } finally {
    try {
      if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (fixture) {
        await sequelize.transaction(async (transaction) => {
          const listingIds = fixture.listings.map((listing) => listing.ListingId);
          const orders = await Orders.findAll({ where: { ListingId: listingIds }, attributes: ['OrderId'], raw: true, transaction });
          const orderIds = orders.map((order) => order.OrderId);
          if (orderIds.length) {
            await Notifications.destroy({ where: { ReferenceType: 'ORDER', ReferenceId: orderIds }, transaction });
            await StatusHistories.destroy({ where: { OrderId: orderIds }, transaction });
            await Orders.destroy({ where: { OrderId: orderIds }, transaction });
          }
          await Listings.destroy({ where: { ListingId: listingIds }, transaction });
          await Categories.destroy({ where: { CategoryId: fixture.category.CategoryId }, transaction });
          await Users.destroy({ where: { UserId: fixture.users.map((user) => user.UserId) }, transaction });
        });
        console.log('Da don dep chi du lieu fixture D01.');
      }
    } finally {
      await sequelize.close();
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
