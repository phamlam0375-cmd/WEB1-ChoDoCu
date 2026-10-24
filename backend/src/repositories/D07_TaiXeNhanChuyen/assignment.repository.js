'use strict';
const { QueryTypes, Transaction, Op } = require('sequelize');
const { sequelize, Users, PartnerApplications, DriverProfiles, Deliveries, Orders, Payments, StatusHistories } = require('../../models');
const { notify } = require('../../services/notification.service');

const withTransaction = work => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, work);
const select = (sql, replacements, transaction) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const activeWhere = userId => ({ DriverId: userId, Status: { [Op.notIn]: ['DELIVERED', 'RETURNED'] } });
async function driver(userId, transaction, lock = false) {
  const options = { transaction, raw: true, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) };
  // Mutex USER -> USER_ROLE -> PROFILE: một tài xế không thể đồng thời nhận hai đơn.
  const user = await Users.findByPk(userId, { ...options, attributes: ['UserId', 'Status'] });
  const [driverRole] = await select("SELECT RoleId FROM Roles WHERE RoleName = 'DRIVER'", {}, transaction);
  // Chỉ khóa grant của chính user; JOIN ... FOR UPDATE sẽ khóa cả Roles.DRIVER
  // chung và vô tình serialize mọi tài xế trên toàn hệ thống.
  const roles = driverRole ? await select(`SELECT RoleId FROM UserRoles
    WHERE UserId = :userId AND RoleId = :roleId${lock ? ' FOR UPDATE' : ''}`, { userId, roleId: driverRole.RoleId }, transaction) : [];
  // Không khóa APPLICATION ngược B02 (APPLICATION -> USER_ROLE). READ COMMITTED đọc quyền/hồ sơ mới nhất.
  const application = await PartnerApplications.findOne({ where: { UserId: userId, PartnerType: 'DRIVER' },
    attributes: ['ApplicationId', 'Status', 'ReviewNote', 'SubmittedAt', 'ReviewedAt'], order: [['SubmittedAt', 'DESC'], ['ApplicationId', 'DESC']], transaction, raw: true });
  const profile = await DriverProfiles.findOne({ where: { UserId: userId }, ...options });
  const active = await Deliveries.findOne({ where: activeWhere(userId), attributes: ['DeliveryId', 'OrderId', 'Status', 'AcceptedAt'], order: [['DeliveryId', 'DESC']], ...options });
  // Không khóa ORDER sau USER: các thao tác nhận/hủy/hoàn tiền lấy ORDER trước.
  if (active) active.OrderStatus = (await Orders.findByPk(active.OrderId, { attributes: ['Status'], transaction, raw: true }))?.Status || null;
  return { user, hasRole: roles.length > 0, application, profile, active };
}

// Một predicate SQL dùng CHUNG cho GET và PATCH, không phân trang xong mới lọc JS.
// Chỉ so khớp khóa khu vực có cấu trúc của snapshot; tuyệt đối không tách địa chỉ để đoán tuyến.
const ELIGIBLE = `d.Status = 'AVAILABLE' AND d.DriverId IS NULL AND d.AcceptedAt IS NULL
  AND o.DeliveryMethod = 'DELIVERY' AND o.Status = 'PAID' AND o.CompletedAt IS NULL
  AND o.DeliveryFeeRuleId IS NOT NULL
  AND p.Status = 'CONFIRMED' AND p.PayerId = o.BuyerId AND p.PayeeId = o.SellerId
  AND p.Amount = o.ProductAmount AND p.Amount >= 0 AND p.ConfirmedBy = o.SellerId
  AND p.ConfirmedAt IS NOT NULL AND p.ReportedAt IS NOT NULL AND p.ReportedAt <= p.ConfirmedAt
  AND LENGTH(TRIM(p.ProofUrl)) > 0 AND LENGTH(TRIM(p.TransferContent)) > 0
  AND LENGTH(TRIM(p.BankName)) > 0 AND p.BankAccountSnapshot REGEXP '^[0-9]{1,30}$'
  AND LENGTH(TRIM(p.BankAccountHolderSnapshot)) > 0
  AND d.ReadyForPickupAt IS NOT NULL AND d.PreparedBy = o.SellerId
  AND d.ReadyForPickupAt >= p.ConfirmedAt AND d.ReadyForPickupAt <= CURRENT_TIMESTAMP
  AND LENGTH(TRIM(d.PickupAddress)) > 0 AND LENGTH(TRIM(d.DeliveryAddress)) > 0
  AND d.DriverFee = o.DeliveryFee AND d.DriverFee >= 0
  AND LOWER(TRIM(d.PickupArea)) = LOWER(:serviceArea) AND LOWER(TRIM(d.DeliveryArea)) = LOWER(:serviceArea)
  AND LOWER(TRIM(d.VehicleType)) = LOWER(:vehicleType)
  AND (:maxDistance IS NULL OR (d.RouteDistanceKm IS NOT NULL AND d.RouteDistanceKm >= 0 AND d.RouteDistanceKm <= :maxDistance))
  AND NOT EXISTS (SELECT 1 FROM RefundRequests r WHERE r.OrderId = o.OrderId AND r.Status <> 'REJECTED')`;
const FROM = 'FROM Deliveries d JOIN Orders o ON o.OrderId = d.OrderId JOIN Payments p ON p.OrderId = o.OrderId';
async function eligible(profile, filter, transaction) {
  const replacements = { serviceArea: profile.ServiceArea.trim(), vehicleType: profile.VehicleType.trim(), maxDistance: profile.MaxDistanceKm ?? null,
    limit: filter.limit ?? 1, offset: filter.offset ?? 0 };
  let where = ELIGIBLE;
  if (filter.id) { where += ' AND d.DeliveryId = :id'; replacements.id = filter.id; }
  for (const [key, column] of [['pickupArea', 'PickupArea'], ['deliveryArea', 'DeliveryArea'], ['vehicleType', 'VehicleType']]) {
    if (filter[key]) { where += ` AND LOWER(TRIM(d.${column})) = LOWER(:filter_${key})`; replacements[`filter_${key}`] = filter[key]; }
  }
  const direction = filter.sort === 'newest' ? 'DESC' : 'ASC';
  const rows = await select(`SELECT d.DeliveryId AS deliveryId, d.OrderId AS orderId, d.PickupArea AS pickupArea,
    d.DeliveryArea AS deliveryArea, d.VehicleType AS vehicleType, d.DriverFee AS driverFee, d.ReadyForPickupAt AS readyAt
    ${FROM} WHERE ${where} ORDER BY d.DeliveryId ${direction} LIMIT :limit OFFSET :offset`, replacements, transaction);
  if (filter.id) return rows.length > 0;
  const [count] = await select(`SELECT COUNT(*) AS total ${FROM} WHERE ${where}`, replacements, transaction);
  return { rows, total: Number(count.total) };
}
const locate = id => Deliveries.findByPk(id, { attributes: ['OrderId'], raw: true });
async function lockState(orderId, id, transaction) {
  // Cùng thứ tự D02/D03/D04/B06: ORDER -> PAYMENT -> DELIVERY. Không khóa REFUND ngược B07.
  const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const payment = await Payments.findOne({ where: { OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  const delivery = await Deliveries.findOne({ where: { DeliveryId: id, OrderId: orderId }, transaction, lock: transaction.LOCK.UPDATE, raw: true });
  return { order, payment, delivery };
}
async function assign(deliveryId, userId, now, transaction) {
  const [count] = await Deliveries.update({ DriverId: userId, Status: 'ACCEPTED', AcceptedAt: now }, {
    where: { DeliveryId: deliveryId, Status: 'AVAILABLE', DriverId: null, AcceptedAt: null }, transaction });
  return count;
}
async function busy(userId, now, transaction) {
  const [count] = await DriverProfiles.update({ AvailabilityStatus: 'BUSY', UpdatedAt: now }, { where: { UserId: userId, AvailabilityStatus: 'AVAILABLE' }, transaction });
  return count;
}
const history = (data, transaction) => StatusHistories.create(data, { transaction });
const notifyUser = (id, data, transaction) => notify(id, data, { transaction });
module.exports = { withTransaction, driver, eligible, locate, lockState, assign, busy, history, notifyUser };
