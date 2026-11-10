'use strict';
const { Op } = require('sequelize');
const { Deliveries, Orders, StatusHistories } = require('../../models');
const progress = require('../D09_CapNhatTienDoGiaoHang/progress.repository');
const { settleDriver } = require('../D10_ThatBai_HoanTra/failure.repository');
const storage = require('../../services/D13_XacThucGiaoHangOTP/completionProof.storage');
const attributes = ['DeliveredAt', 'VerifiedAt', 'ReturnedAt', 'D10Revision', 'CompletionCodeHash', 'CompletionCodeExpiresAt', 'CompletionCodeIssuedAt', 'CompletionCodeUsedAt',
  'CompletionCodeSession', 'CompletionCodeDriverId', 'CompletionCodeRunRevision', 'CompletionCodeAttempts', 'CompletionIssueWindowAt', 'CompletionIssueCount', 'CompletionProofKey', 'CompletionProofDigest'];
async function hydrateVerification(deliveries, transaction) {
  for (const d of deliveries) {
    d.HasD13Event = false; d.CompletionProofAvailable = false;
    if (d.Status !== 'DELIVERED' || !d.VerifiedAt || !d.CompletionProofKey || !d.CompletionProofDigest) continue;
    d.HasD13Event = await StatusHistories.count({ where: { DeliveryId: d.DeliveryId, OrderId: d.OrderId, StatusType: 'DELIVERY', StatusValue: 'DELIVERED',
      ChangedBy: d.DriverId, CreatedAt: d.VerifiedAt, D09RequestId: { [Op.ne]: null } }, transaction, logging: false }) > 0;
    d.CompletionProofAvailable = await storage.valid(d.CompletionProofKey, d.CompletionProofDigest);
  }
  return deliveries;
}
async function readState(orderId, deliveryId, tx, lock = false) {
  const state = await progress.readState(orderId, deliveryId, tx, lock);
  if (!state?.delivery) return state;
  const extra = await Deliveries.findByPk(state.delivery.DeliveryId, { attributes, transaction: tx, raw: true, logging: false });
  state.delivery = { ...state.delivery, ...extra };
  await hydrateVerification([state.delivery], tx);
  return state;
}
const issueCode = (d, values, transaction) => Deliveries.update(values, { where: { DeliveryId: d.DeliveryId, DriverId: d.DriverId, Status: 'DELIVERING', VerifiedAt: null, CompletionCodeUsedAt: null }, transaction, logging: false }).then(([count]) => count);
const failedAttempt = (d, transaction) => Deliveries.update({ CompletionCodeAttempts: Number(d.CompletionCodeAttempts) + 1 }, {
  where: { DeliveryId: d.DeliveryId, DriverId: d.DriverId, Status: 'DELIVERING', CompletionCodeSession: d.CompletionCodeSession, CompletionCodeAttempts: d.CompletionCodeAttempts, CompletionCodeUsedAt: null }, transaction, logging: false }).then(([count]) => count);
async function complete(state, changes, transaction) {
  const d = state.delivery;
  const [delivery] = await Deliveries.update({ ...changes, D10Revision: Number(d.D10Revision) + 1 }, { where: {
    DeliveryId: d.DeliveryId, DriverId: d.DriverId, Status: 'DELIVERING', D10Revision: d.D10Revision, VerifiedAt: null, DeliveredAt: null,
    CompletionCodeSession: d.CompletionCodeSession, CompletionCodeUsedAt: null, CompletionCodeAttempts: d.CompletionCodeAttempts, CompletionCodeExpiresAt: { [Op.gt]: changes.VerifiedAt },
  }, transaction, logging: false });
  const [order] = await Orders.update({ Status: 'DELIVERED' }, { where: { OrderId: state.order.OrderId, Status: 'IN_DELIVERY', CompletedAt: null }, transaction, logging: false });
  return delivery === 1 && order === 1;
}
const proofIsReferenced = key => Deliveries.count({ where: { CompletionProofKey: key }, logging: false });
const locate = (id, transaction) => Deliveries.findByPk(id, { attributes: ['OrderId'], transaction, raw: true, logging: false });
const history = (data, transaction) => StatusHistories.create(data, { transaction, logging: false });
module.exports = { ...progress, locate, readState, issueCode, failedAttempt, complete, settleDriver, proofIsReferenced, hydrateVerification, history };
