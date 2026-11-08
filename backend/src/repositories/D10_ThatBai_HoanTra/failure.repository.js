'use strict';
const { Op } = require('sequelize');
const { Deliveries, DriverProfiles, StatusHistories } = require('../../models');
const progress = require('../D09_CapNhatTienDoGiaoHang/progress.repository');
async function readState(orderId, deliveryId, tx, lock = false) {
  const state = await progress.readState(orderId, deliveryId, tx, lock);
  if (!state?.delivery) return state;
  const extra = await Deliveries.findByPk(deliveryId, { attributes: ['RetryCount', 'FailureReason', 'ReturnedAt', 'RetryScheduledAt', 'D10Revision', 'DeliveredAt', 'VerifiedAt'], transaction: tx, raw: true });
  state.delivery = { ...state.delivery, ...extra };
  state.failureCount = await StatusHistories.count({ where: { DeliveryId: deliveryId, StatusType: 'DELIVERY', StatusValue: 'FAILED' }, transaction: tx });
  state.lastReturn = await StatusHistories.findOne({ where: { DeliveryId: deliveryId, StatusType: 'DELIVERY', StatusValue: 'RETURNED' }, attributes: ['HistoryId', 'ChangedBy', 'CreatedAt', 'Note', 'D10Event'], order: [['HistoryId', 'DESC']], transaction: tx, raw: true });
  return state;
}
async function change(d, updates, tx) {
  const [count] = await Deliveries.update({ ...updates, D10Revision: Number(d.D10Revision) + 1 }, { where: { DeliveryId: d.DeliveryId, DriverId: d.DriverId, Status: d.Status, D10Revision: d.D10Revision }, transaction: tx, logging: false });
  return count;
}
async function settleDriver(id, deliveryId, tx, now) {
  // Giữ mutex USER/PROFILE từ driver() trước khi kiểm tra các nhiệm vụ khác.
  const active = await Deliveries.count({ where: { DriverId: id, DeliveryId: { [Op.ne]: deliveryId }, Status: { [Op.notIn]: ['DELIVERED', 'RETURNED'] } }, transaction: tx });
  if (!active) await DriverProfiles.update({ AvailabilityStatus: 'OFFLINE', UpdatedAt: now }, { where: { UserId: id, AvailabilityStatus: 'BUSY' }, transaction: tx });
}
module.exports = { ...progress, readState, change, settleDriver };
