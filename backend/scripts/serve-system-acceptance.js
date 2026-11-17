'use strict';
const assert = require('node:assert/strict');
if (process.env.D13_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Local test database only.');
const mail = [];
// Hộp thư test tại biên SMTP, không thay OTP/validation hoặc handler ứng dụng.
require('nodemailer').createTransport = () => ({ sendMail: async item => {
  assert.ok(String(item.to).startsWith(process.env.D13_BROWSER_PREFIX + '_') && String(item.to).endsWith('@example.test'));
  mail.push({ to: String(item.to), subject: item.subject, text: item.text || '', html: item.html || '' });
  return { messageId: 'local-mail-sandbox' };
}, verify: async () => true });
process.env.MAIL_USER = process.env.EMAIL_USER = 'sandbox@example.test';
process.env.MAIL_PASS = process.env.EMAIL_PASS = 'local-transport-no-network';
const { createD13Environment } = require('../tests/helpers/d13-fixture');
let f, runtime;
(async () => {
  f = await createD13Environment({ browser: true });
  process.env.MAIL_USER = process.env.EMAIL_USER = 'sandbox@example.test';
  process.env.MAIL_PASS = process.env.EMAIL_PASS = 'local-transport-no-network';
  const { Users, Roles, UserRoles, UserCredits } = f.models;
  const driver = await f.person('browserdriver', process.env.SYSTEM_ROUND2 === 'true' ? { driver: true, profile: false } : {}), admin = await f.person('auditadmin');
  if (process.env.SYSTEM_ROUND2 === 'true') {
    const sellerRole = await Roles.findOne({ where: { RoleName: 'SELLER' } });
    await UserRoles.create({ UserId: f.seller.UserId, RoleId: sellerRole.RoleId });
  }
  for (const user of [f.buyer, f.seller, driver, admin]) {
    const role = await Roles.findOne({ where: { RoleName: 'USER' } });
    await UserRoles.findOrCreate({ where: { UserId: user.UserId, RoleId: role.RoleId } });
    // Chỉ khởi tạo liên hệ của tài khoản fixture vừa tạo, trước mọi bước nghiệp vụ.
    await user.update({ Phone: '09' + String(user.UserId).padStart(8, '0') });
  }
  const adminRole = (await Roles.findOrCreate({ where: { RoleName: 'ADMIN' } }))[0];
  await UserRoles.create({ UserId: admin.UserId, RoleId: adminRole.RoleId });
  await UserCredits.create({ UserId: f.seller.UserId, Balance: 1000 });
  const placeholder = await f.listing(), pickup = await f.listing({ Title: f.prefix + ' PICKUP', Price: '88888.88' }), report = await f.listing({ Title: f.prefix + ' report fixture', Price: '100000.00' });
  await f.listing({ Title: f.prefix + ' compare one' }); await f.listing({ Title: f.prefix + ' compare two' });
  let listingIds = [placeholder.ListingId, pickup.ListingId, report.ListingId];
  // Dùng chính HTTP/Socket.IO của production; không khởi động job Elasticsearch/SMTP.
  await new Promise(resolve => f.server.close(resolve));
  runtime = require('../src/server');
  runtime.httpServer.listen(0, '127.0.0.1'); await new Promise(resolve => runtime.httpServer.once('listening', resolve));
  const ownUser = async email => {
    assert.ok(String(email).startsWith(f.prefix + '_') && String(email).endsWith('@example.test'));
    return Users.findOne({ where: { Email: email }, attributes: ['UserId','Email','FullName','Phone','Address','EmailVerified','PhoneVerified','Status'], raw: true });
  };
  process.on('message', async message => {
    try {
      if (message?.type === 'D_LINK_READ') {
        const data = await require('../tests/helpers/d-link-snapshot')(f, driver.UserId, listingIds)(message);
        return process.send({ type: 'D_LINK_RESULT', id: message.id, data });
      }
      if (message?.type !== 'SYSTEM_READ') return;
      let data;
      if (message.action === 'mail') {
        await ownUser(message.email); // ràng buộc email test, có thể chưa xác thực xong
        const matching = mail.filter(item => item.to === message.email && /\b\d{6}\b/.test(item.text + item.html));
        const item = matching.at(-1); assert.ok(item, 'Sandbox OTP mail not found');
        data = { code: (item.text + item.html).match(/\b\d{6}\b/)[0], deliveredOutside: false };
      } else if (message.action === 'user') {
        data = await ownUser(message.email);
        if (data) data.roles = (await UserRoles.findAll({ where: { UserId: data.UserId }, include: [{ model: Roles }], logging: false })).map(row => row.Role.RoleName);
      } else if (message.action === 'configureListing' || message.action === 'listing') {
        const row = await f.models.Listings.findByPk(message.listingId, { raw: true });
        assert.equal(row.SellerId, f.seller.UserId); assert.ok(row.Title.startsWith(f.prefix));
        if (message.action === 'configureListing') listingIds = [...new Set([...listingIds, row.ListingId])];
        data = { listingId: row.ListingId, title: row.Title, status: row.Status, price: row.Price, categoryId: row.CategoryId, storeId: row.StoreId };
      } else if (message.action === 'reviewsDiagnostic') {
        const order = await f.models.Orders.findByPk(message.orderId, { raw: true }); assert.equal(order.BuyerId, f.buyer.UserId);
        try { await require('../src/services/review.service').listOrderReviews(order.OrderId, order.BuyerId); data = { error: null }; }
        catch (e) { data = { error: e.name, message: e.message }; }
      } else if (message.action === 'records') {
        const { Op } = require('sequelize');
        const users = await Users.findAll({ where: { Email: { [Op.like]: f.prefix + '_%@example.test' } }, attributes: ['UserId','Email','FullName','EmailVerified','PhoneVerified','Status'], raw: true });
        const ids = users.map(user => user.UserId), opts = { raw: true, logging: false };
        data = { users, applications: await f.models.PartnerApplications.findAll({ where: { UserId: ids }, ...opts }),
          notifications: await f.models.Notifications.findAll({ where: { UserId: ids }, ...opts }),
          store: await f.models.Store.findOne({ where: { OwnerId: f.seller.UserId }, ...opts }),
          credits: await UserCredits.findOne({ where: { UserId: f.seller.UserId }, ...opts }),
          promotions: await f.models.ListingPromotions.findAll({ where: { SellerId: f.seller.UserId }, ...opts }),
          commissions: await f.models.Commissions.findAll({ where: { SellerId: f.seller.UserId }, ...opts }),
          audit: await f.models.AdminAuditLogs.findAll({ where: { AdminId: admin.UserId }, ...opts }).catch(() => []),
          refunds: await f.models.RefundRequests.findAll({ where: { RequestedBy: f.buyer.UserId }, ...opts }) };
        data.reports = await f.models.Reports.findAll({ where: { ReporterId: f.buyer.UserId }, ...opts });
      } else throw new Error('Unknown read-only test action');
      process.send({ type: 'SYSTEM_RESULT', id: message.id, data });
    } catch (e) { process.send({ type: message?.type === 'D_LINK_READ' ? 'D_LINK_RESULT' : 'SYSTEM_RESULT', id: message.id, error: e.code || e.name }); }
  });
  console.log('D13_BROWSER_FIXTURE ' + JSON.stringify({ apiPort: runtime.httpServer.address().port, listingId: placeholder.ListingId, legacyListingId: placeholder.ListingId, pickupListingId: pickup.ListingId, pickupTitle: pickup.Title, reportListingId: report.ListingId,
    title: placeholder.Title, area: f.area, buyerId: f.buyer.UserId, sellerId: f.seller.UserId, driverId: driver.UserId, adminId: admin.UserId }));
  await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
})().catch(e => { console.error('System fixture:', e.name, e.code || ''); process.exitCode = 1; }).finally(async () => { if (runtime) await new Promise(resolve => runtime.io.close(resolve)); if (f) await f.close(); });
