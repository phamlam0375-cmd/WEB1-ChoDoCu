'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Op, Transaction } = require('sequelize');
// Chỉ đọc qua IPC của tiến trình test. Không mount endpoint quan sát lên Express.
module.exports = (f, driverId, listingIds) => async input => {
  assert.equal(process.env.D_LINK_TEST, 'true');
  assert.ok(listingIds.includes(Number(input.listingId)));
  const m = f.models;
  return m.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async transaction => {
    const opts = { transaction, raw: true, logging: false };
    const listing = await m.Listings.findByPk(input.listingId, { ...opts, attributes: ['ListingId', 'SellerId', 'Status', 'Price'] });
    assert.equal(Number(listing.SellerId), f.seller.UserId);
    const profile = await m.DriverProfiles.findOne({ where: { UserId: driverId }, ...opts });
    const active = await m.Deliveries.count({ where: { DriverId: driverId, Status: { [Op.notIn]: ['DELIVERED', 'RETURNED'] } }, transaction, logging: false });
    const result = { listing, driver: { userId: driverId, profile: profile ? { availability: profile.AvailabilityStatus, area: profile.ServiceArea, vehicle: profile.VehicleType,
      bankNumber: profile.BankAccountNumber, bankReady: Boolean(profile.BankName && profile.BankAccountNumber && profile.BankAccountHolder),
      qrValid: await require('../../src/services/D11_HoSoVanHanhTaiXe/qr.storage').valid(driverId, profile.QrImageUrl) } : null, active } };
    if (!input.orderId) return result;
    const order = await m.Orders.findByPk(input.orderId, { ...opts, attributes: ['OrderId', 'ListingId', 'BuyerId', 'SellerId', 'Status', 'DeliveryMethod', 'ProductAmount', 'DeliveryFee', 'TotalAmount', 'CommissionRate', 'CompletedAt', 'ReservedUntil'] });
    assert.equal(Number(order.BuyerId), f.buyer.UserId); assert.equal(Number(order.SellerId), f.seller.UserId); assert.equal(Number(order.ListingId), Number(input.listingId));
    const payment = await m.Payments.findOne({ where: { OrderId: order.OrderId }, ...opts, attributes: ['OrderId', 'PayerId', 'PayeeId', 'Amount', 'Status', 'ReportedAt', 'ConfirmedAt', 'ConfirmedBy', 'ProofUrl'] });
    const [deliveries] = await m.sequelize.query(`SELECT DeliveryId,OrderId,DriverId,Status,DriverFee,AcceptedAt,PickedUpAt,DeliveredAt,VerifiedAt,ReturnedAt,ProofUrl,
      PickupCodeUsedAt,PickupProofKey,PickupProofDigest,CompletionCodeUsedAt,CompletionProofKey,CompletionProofDigest,
      (PickupCodeHash IS NOT NULL) AS pickupHashStored,(CompletionCodeHash IS NOT NULL) AS completionHashStored
      FROM Deliveries WHERE OrderId=:id`, { ...opts, replacements: { id: order.OrderId } });
    for (const d of deliveries) {
      if (input.deliveryId) assert.equal(Number(d.DeliveryId), Number(input.deliveryId));
      d.pickupProofAvailable = Boolean(d.PickupProofKey) && await require('../../src/services/D08_XacNhanLayHang/pickupProof.storage').valid(d.PickupProofKey, d.PickupProofDigest);
      d.completionProofAvailable = Boolean(d.CompletionProofKey) && await require('../../src/services/D13_XacThucGiaoHangOTP/completionProof.storage').valid(d.CompletionProofKey, d.CompletionProofDigest);
      d.pickupProofFingerprint = d.PickupProofKey ? crypto.createHash('sha256').update(d.PickupProofKey + d.PickupProofDigest).digest('hex') : null;
      delete d.PickupProofKey; delete d.PickupProofDigest; delete d.CompletionProofKey; delete d.CompletionProofDigest;
    }
    const histories = await m.StatusHistories.findAll({ where: { OrderId: order.OrderId }, ...opts, attributes: ['HistoryId', 'OrderId', 'DeliveryId', 'StatusType', 'StatusValue', 'ChangedBy', 'CreatedAt'], order: [['HistoryId', 'ASC']] });
    const notifications = await m.Notifications.findAll({ where: { ReferenceId: order.OrderId, ReferenceType: { [Op.in]: ['ORDER', 'PAYMENT'] } }, ...opts, attributes: ['NotificationId', 'UserId', 'Type', 'ReferenceType', 'ReferenceId', 'Title'] });
    const commissions = await m.Commissions.findAll({ where: { OrderId: order.OrderId }, ...opts, attributes: ['CommissionId', 'OrderId', 'SellerId', 'Rate', 'OriginalAmount', 'AmountDue', 'Status'] });
    const refunds = await m.RefundRequests.count({ where: { OrderId: order.OrderId }, transaction, logging: false });
    return { ...result, order, payment, deliveries, histories, notifications, commissions, refunds };
  });
};
