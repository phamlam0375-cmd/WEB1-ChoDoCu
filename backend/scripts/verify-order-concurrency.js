'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const app = require('../src/app');
const {
  sequelize,
  Categories,
  Listings,
  Notifications,
  Orders,
  StatusHistories,
  Users
} = require('../src/models');

async function request(baseUrl, listingId, userId) {
  const headers = { 'content-type': 'application/json' };
  if (userId) headers['x-user-id'] = String(userId);
  const response = await fetch(`${baseUrl}/api/v1/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      listingId,
      deliveryMethod: 'PICKUP',
      receiverName: 'Nguoi mua thu nghiem',
      receiverPhone: '0901234567',
      note: 'Kiem tra tranh dat trung'
    })
  });
  return { status: response.status, body: await response.json() };
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main() {
  let server;
  let category;
  let listing;
  let seller;
  let buyerOne;
  let buyerTwo;
  let createdOrderId;
  let connected = false;
  const suffix = `${Date.now()}-${process.pid}`;

  try {
    await sequelize.authenticate();
    connected = true;
    [seller, buyerOne, buyerTwo] = await Promise.all([
      Users.create({
        Username: `d01-seller-${suffix}`,
        FullName: 'D01 Seller',
        Email: `d01-seller-${suffix}@example.test`,
        Phone: `091${String(Date.now()).slice(-7)}`,
        Status: 'ACTIVE'
      }),
      Users.create({
        Username: `d01-buyer-a-${suffix}`,
        FullName: 'D01 Buyer A',
        Email: `d01-buyer-a-${suffix}@example.test`,
        Status: 'ACTIVE'
      }),
      Users.create({
        Username: `d01-buyer-b-${suffix}`,
        FullName: 'D01 Buyer B',
        Email: `d01-buyer-b-${suffix}@example.test`,
        Status: 'ACTIVE'
      })
    ]);
    category = await Categories.create({
      CategoryName: `D01 concurrency ${suffix}`,
      Description: 'Du lieu tam de kiem tra tranh dat trung',
      Status: 'ACTIVE'
    });
    listing = await Listings.create({
      SellerId: seller.UserId,
      CategoryId: category.CategoryId,
      Title: 'San pham kiem tra dat dong thoi',
      Description: 'Chi dung trong bai test tich hop D01',
      Price: '1234567.00',
      ConditionLevel: 'USED_GOOD',
      Location: 'TP. Ho Chi Minh',
      Status: 'ACTIVE'
    });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const unauthenticated = await request(baseUrl, listing.ListingId, null);
    assert.equal(unauthenticated.status, 401, 'POST /orders phai yeu cau dang nhap');

    const responses = await Promise.all([
      request(baseUrl, listing.ListingId, buyerOne.UserId),
      request(baseUrl, listing.ListingId, buyerTwo.UserId)
    ]);
    const statuses = responses.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 409], 'phai co dung mot 201 va mot 409');
    assert.equal(responses.find((response) => response.status === 409).body.code, 'LISTING_UNAVAILABLE');

    const orders = await Orders.findAll({ where: { ListingId: listing.ListingId }, raw: true });
    assert.equal(orders.length, 1, 'chi duoc tao mot order');
    assert.equal(orders[0].Status, 'RESERVED');
    assert.equal(String(orders[0].ProductAmount), '1234567.00');
    assert.equal(String(orders[0].TotalAmount), '1234567.00');
    createdOrderId = orders[0].OrderId;

    const [freshListing, histories, notifications] = await Promise.all([
      Listings.findByPk(listing.ListingId, { raw: true }),
      StatusHistories.count({ where: { OrderId: createdOrderId, StatusValue: 'RESERVED' } }),
      Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: createdOrderId } })
    ]);
    assert.equal(freshListing.Status, 'RESERVED');
    assert.equal(histories, 1, 'phai co mot lich su RESERVED');
    assert.equal(notifications, 1, 'phai co mot thong bao cho nguoi ban');

    console.log(JSON.stringify({
      ok: true,
      endpoint: '/api/v1/orders',
      unauthenticatedStatus: unauthenticated.status,
      concurrentStatuses: statuses,
      persisted: { orders: orders.length, histories, notifications },
      listingStatus: freshListing.Status
    }, null, 2));
  } finally {
    await closeServer(server);
    if (connected) {
      const cleanupOrders = listing
        ? await Orders.findAll({ where: { ListingId: listing.ListingId }, attributes: ['OrderId'], raw: true })
        : [];
      const cleanupOrderIds = cleanupOrders.map((order) => order.OrderId);
      if (cleanupOrderIds.length) {
        await Notifications.destroy({ where: { ReferenceType: 'ORDER', ReferenceId: cleanupOrderIds } });
        await StatusHistories.destroy({ where: { OrderId: cleanupOrderIds } });
        await Orders.destroy({ where: { OrderId: cleanupOrderIds } });
      }
      if (listing) await Listings.destroy({ where: { ListingId: listing.ListingId } });
      if (category) await Categories.destroy({ where: { CategoryId: category.CategoryId } });
      const userIds = [seller, buyerOne, buyerTwo].filter(Boolean).map((user) => user.UserId);
      if (userIds.length) await Users.destroy({ where: { UserId: userIds } });
      await sequelize.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
