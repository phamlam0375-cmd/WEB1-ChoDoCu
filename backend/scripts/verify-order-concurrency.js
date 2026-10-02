'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { QueryTypes } = require('sequelize');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'd01-integration-test-secret-not-for-production';

const app = require('../src/app');
const sequelize = require('../src/database');

const suffix = `${Date.now()}_${crypto.randomInt(1000, 9999)}`;
const baseId = 3000000000 + crypto.randomInt(1000000, 900000000);
const ids = {
  seller: baseId,
  buyerOne: baseId + 1,
  buyerTwo: baseId + 2,
  category: baseId,
  listing: baseId
};
let server;

function signToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: userId, iat: now, exp: now + 300 });
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function setup() {
  await sequelize.transaction(async (transaction) => {
    for (const [userId, name] of [
      [ids.seller, 'D01 Seller'],
      [ids.buyerOne, 'D01 Buyer One'],
      [ids.buyerTwo, 'D01 Buyer Two']
    ]) {
      await sequelize.query(
        `INSERT INTO Users
          (UserId, Username, PasswordHash, FullName, Email, Phone, EmailVerified, PhoneVerified, Status, CreatedAt)
         VALUES
          (:userId, :username, NULL, :name, :email, NULL, 1, 0, 'ACTIVE', CURRENT_TIMESTAMP)`,
        {
          replacements: {
            userId,
            username: `d01_${userId}_${suffix}`,
            name,
            email: `d01_${userId}_${suffix}@example.local`
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );
    }

    await sequelize.query(
      `INSERT INTO Categories (CategoryId, CategoryName, Description, Status, CreatedAt)
       VALUES (:categoryId, :name, 'D01 integration test', 'ACTIVE', CURRENT_TIMESTAMP)`,
      {
        replacements: { categoryId: ids.category, name: `D01 Category ${suffix}` },
        type: QueryTypes.INSERT,
        transaction
      }
    );
    await sequelize.query(
      `INSERT INTO Listings
        (ListingId, SellerId, StoreId, CategoryId, Title, Description, Price,
         ConditionLevel, KnownDefects, Location, Status, CreatedAt)
       VALUES
        (:listingId, :sellerId, NULL, :categoryId, 'D01 concurrency product',
         'Temporary integration test data', 1000000.00, 'GOOD', NULL,
         'TP. Hồ Chí Minh', 'ACTIVE', CURRENT_TIMESTAMP)`,
      {
        replacements: {
          listingId: ids.listing,
          sellerId: ids.seller,
          categoryId: ids.category
        },
        type: QueryTypes.INSERT,
        transaction
      }
    );
  });
}

async function cleanup() {
  await sequelize.transaction(async (transaction) => {
    const orderRows = await sequelize.query(
      'SELECT OrderId FROM Orders WHERE ListingId = :listingId',
      { replacements: { listingId: ids.listing }, type: QueryTypes.SELECT, transaction }
    );
    const orderIds = orderRows.map((row) => row.OrderId);
    if (orderIds.length > 0) {
      await sequelize.query(
        'DELETE FROM Notifications WHERE ReferenceType = \'ORDER\' AND ReferenceId IN (:orderIds)',
        { replacements: { orderIds }, type: QueryTypes.DELETE, transaction }
      );
      await sequelize.query(
        'DELETE FROM StatusHistories WHERE OrderId IN (:orderIds)',
        { replacements: { orderIds }, type: QueryTypes.DELETE, transaction }
      );
    }
    await sequelize.query(
      'DELETE FROM Orders WHERE ListingId = :listingId',
      { replacements: { listingId: ids.listing }, type: QueryTypes.DELETE, transaction }
    );
    await sequelize.query(
      'DELETE FROM Listings WHERE ListingId = :listingId',
      { replacements: { listingId: ids.listing }, type: QueryTypes.DELETE, transaction }
    );
    await sequelize.query(
      'DELETE FROM Categories WHERE CategoryId = :categoryId',
      { replacements: { categoryId: ids.category }, type: QueryTypes.DELETE, transaction }
    );
    await sequelize.query(
      'DELETE FROM Users WHERE UserId IN (:userIds)',
      {
        replacements: { userIds: [ids.seller, ids.buyerOne, ids.buyerTwo] },
        type: QueryTypes.DELETE,
        transaction
      }
    );
  });
}

async function run() {
  await sequelize.authenticate();
  await setup();
  try {
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const { port } = server.address();
    const endpoint = `http://127.0.0.1:${port}/api/orders`;
    const payload = {
      listingId: ids.listing,
      deliveryMethod: 'PICKUP',
      receiverName: 'Nguyễn Văn A',
      receiverPhone: '0912345678',
      note: 'Kiểm tra đồng thời D01'
    };

    const unauthorized = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(unauthorized.status, 401, 'Request chưa đăng nhập phải nhận HTTP 401.');

    const responses = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signToken(ids.buyerOne)}`
        },
        body: JSON.stringify(payload)
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signToken(ids.buyerTwo)}`
        },
        body: JSON.stringify(payload)
      })
    ]);
    const responseBodies = await Promise.all(responses.map((response) => response.json()));
    const successful = responses.filter((response) => response.status === 201);
    const conflicts = responses.filter((response) => response.status === 409);
    const conflictIndex = responses.findIndex((response) => response.status === 409);

    assert.equal(successful.length, 1, 'Phải có đúng một request HTTP 201.');
    assert.equal(conflicts.length, 1, 'Phải có đúng một request HTTP 409.');
    assert.ok(
      ['LISTING_UNAVAILABLE', 'RESERVATION_CONFLICT'].includes(
        responseBodies[conflictIndex].error.code
      )
    );

    const [counts] = await sequelize.query(
      `SELECT
        (SELECT COUNT(*) FROM Orders WHERE ListingId = :listingId AND Status = 'RESERVED') AS OrdersCount,
        (SELECT COUNT(*) FROM StatusHistories sh INNER JOIN Orders o ON o.OrderId = sh.OrderId
          WHERE o.ListingId = :listingId AND sh.StatusValue = 'RESERVED') AS HistoriesCount,
        (SELECT COUNT(*) FROM Notifications n INNER JOIN Orders o ON o.OrderId = n.ReferenceId
          WHERE n.ReferenceType = 'ORDER' AND o.ListingId = :listingId) AS NotificationsCount,
        (SELECT Status FROM Listings WHERE ListingId = :listingId) AS ListingStatus`,
      { replacements: { listingId: ids.listing }, type: QueryTypes.SELECT }
    );

    assert.equal(Number(counts.OrdersCount), 1);
    assert.equal(Number(counts.HistoriesCount), 1);
    assert.equal(Number(counts.NotificationsCount), 1);
    assert.equal(counts.ListingStatus, 'RESERVED');

    console.log(JSON.stringify({
      passed: true,
      unauthorizedStatus: unauthorized.status,
      successfulRequests: successful.length,
      conflictRequests: conflicts.length,
      conflictStatus: responses[conflictIndex].status,
      conflictCode: responseBodies[conflictIndex].error.code,
      orders: Number(counts.OrdersCount),
      histories: Number(counts.HistoriesCount),
      notifications: Number(counts.NotificationsCount),
      listingStatus: counts.ListingStatus
    }, null, 2));
  } finally {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (
        error ? reject(error) : resolve()
      )));
    }
    await cleanup();
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
