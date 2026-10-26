'use strict';
const { Orders, Deliveries, StatusHistories } = require('../../models');
// Dùng cùng snapshot và thứ tự khóa D08: ORDER -> PAYMENT -> DELIVERY -> USER/GRANT/PROFILE.
const pickup = require('../D08_XacNhanLayHang/pickup.repository');
const eventAttributes = ['HistoryId', 'OrderId', 'DeliveryId', 'ChangedBy', 'StatusType', 'StatusValue', 'Note', 'CreatedAt', 'D09RequestId', 'D09RequestHash'];
const requestEvent = (id, key, transaction) => StatusHistories.findOne({ where: { DeliveryId: id, D09RequestId: key }, attributes: eventAttributes, transaction, raw: true, logging: false });
const startEvent = (id, transaction) => StatusHistories.findOne({ where: { DeliveryId: id, StatusType: 'DELIVERY', StatusValue: 'DELIVERING' }, attributes: eventAttributes, order: [['HistoryId', 'ASC']], transaction, raw: true, logging: false });
async function start(state, userId, transaction) {
  const [deliveries] = await Deliveries.update({ Status: 'DELIVERING' }, { where: { DeliveryId: state.delivery.DeliveryId, DriverId: userId, Status: 'PICKED_UP', PickedUpAt: state.delivery.PickedUpAt, PickupCodeUsedAt: state.delivery.PickupCodeUsedAt }, transaction, logging: false });
  const [orders] = await Orders.update({ Status: 'IN_DELIVERY' }, { where: { OrderId: state.order.OrderId, Status: 'PAID', CompletedAt: null }, transaction });
  return deliveries === 1 && orders === 1;
}
module.exports = { ...pickup, requestEvent, startEvent, start };
