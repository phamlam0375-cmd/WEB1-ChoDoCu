'use strict';

// Production UI + controller/service + SQL thật, fixture trong transaction rollback.
// Không start job, migrate, seed hoặc chạy CD.
require('dotenv').config();
process.env.NODE_ENV = 'production';
process.env.AUTH_DEV_HEADER = 'false';
process.env.D01_DEMO_MODE = 'true';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Users, Categories, Listings, Orders, StatusHistories, Notifications } = require('../src/models');
const repository = require('../src/repositories/order.repository');

async function main() {
  let transaction, server, listing, deadline, requestStop;
  const stopped = new Promise(resolve => { requestStop = resolve; });
  const original = { withTransaction: repository.withTransaction, findListingPreview: repository.findListingPreview };
  try {
    const dist = path.resolve(__dirname, '../../frontend/dist/demo-on');
    assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Build dist/demo-on với VITE_D01_DEMO_MODE=true trước.');
    const demoId = Number(process.env.D01_DEMO_USER_ID);
    assert.ok(Number.isSafeInteger(demoId) && demoId > 0, 'Cần D01_DEMO_USER_ID của tài khoản ACTIVE không ADMIN.');
    const demo = await Users.findByPk(demoId, { include: [{ association: 'Roles' }] });
    assert.ok(demo && demo.Status === 'ACTIVE' && !demo.Roles.some(role => role.RoleName === 'ADMIN'), 'Tài khoản demo không hợp lệ.');
    const seller = await Users.findOne({ where: { Status: 'ACTIVE', UserId: { [Op.ne]: demoId } } });
    assert.ok(seller, 'Cần người bán khác tài khoản demo.');
    transaction = await sequelize.transaction();
    const category = await Categories.create({ CategoryName: `D01 production fixture ${Date.now()}`, Status: 'ACTIVE' }, { transaction });
    listing = await Listings.create({
      SellerId: seller.UserId, CategoryId: category.CategoryId,
      Title: 'D01 production demo fixture', Description: 'Fixture được rollback khi kết thúc.',
      Price: '123456.00', ConditionLevel: 'GOOD', Status: 'ACTIVE', Location: 'Test',
    }, { transaction });
    // SQL giữ nguyên; scope transaction để thấy fixture chưa commit.
    repository.findListingPreview = id => original.findListingPreview(id, transaction);
    repository.withTransaction = work => work(transaction);
    const app = require('../src/app');
    const site = express();
    // Chỉ server fixture bind loopback; không phải route của app/CD.
    site.post('/__d01_verify__/stop', (_req, res) => { res.sendStatus(202); requestStop(); });
    site.use((req, res, next) => req.path.startsWith('/api/') ? app(req, res, next) : next());
    site.use(express.static(dist));
    site.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
    server = site.listen(Number(process.env.D01_VERIFY_PORT || 4180), '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    console.log(`PRODUCTION_FIXTURE_URL http://127.0.0.1:${server.address().port}/orders/create/${listing.ListingId}`);
    console.log(`D01_DEMO_USER_ID ${demoId}; NODE_ENV=production; AUTH_DEV_HEADER=false; D01_DEMO_MODE=true`);
    console.log('Sau khi đặt hàng, POST /__d01_verify__/stop (hoặc stdin stop/Ctrl+C) để kiểm tra SQL và rollback.');
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', text => { if (text.trim() === 'stop') requestStop(); });
    process.once('SIGINT', requestStop);
    process.once('SIGTERM', requestStop);
    deadline = setTimeout(requestStop, 10 * 60 * 1000);
    deadline.unref();
    await stopped;
    const orders = await Orders.findAll({ where: { ListingId: listing.ListingId }, transaction });
    assert.equal(orders.length, 1, 'Cần tạo đúng một đơn fixture trên UI trước khi stop.');
    assert.equal(orders[0].BuyerId, demoId);
    assert.equal(orders[0].Status, 'RESERVED');
    assert.equal(String(orders[0].TotalAmount), '123456.00');
    assert.equal((await Listings.findByPk(listing.ListingId, { transaction })).Status, 'RESERVED');
    assert.equal(await StatusHistories.count({ where: { OrderId: orders[0].OrderId }, transaction }), 1);
    assert.equal(await Notifications.count({ where: { ReferenceType: 'ORDER', ReferenceId: orders[0].OrderId }, transaction }), 1);
    console.log('PASS: SQL order RESERVED, correct demo buyer, price/history/notification.');
  } finally {
    clearTimeout(deadline);
    process.stdin.pause();
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (transaction && !transaction.finished) await transaction.rollback();
    Object.assign(repository, original);
    try {
      if (listing) {
        assert.equal(await Listings.count({ where: { ListingId: listing.ListingId } }), 0);
        assert.equal(await Orders.count({ where: { ListingId: listing.ListingId } }), 0);
        console.log('PASS: ROLLBACK fixture; no persistent listing/order/history/notification.');
      }
    } finally {
      await sequelize.close();
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
