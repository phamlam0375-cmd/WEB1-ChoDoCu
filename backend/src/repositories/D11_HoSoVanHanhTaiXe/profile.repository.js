'use strict';
const { DriverProfiles, sequelize } = require('../../models');
const assignment = require('../D07_TaiXeNhanChuyen/assignment.repository');
module.exports = {
  withTransaction: assignment.withTransaction,
  // USER là mutex chung với D07/D10. Không khóa DELIVERY sau USER ở D11.
  state: (userId, tx, lock = false) => assignment.driver(userId, tx, lock, { lockActive: false }),
  create: (values, transaction) => DriverProfiles.create(values, { transaction }),
  update: (userId, values, transaction) => DriverProfiles.update(values, { where: { UserId: userId }, transaction }),
  referenced: url => DriverProfiles.count({ where: { QrImageUrl: url } }),
  // Dùng mã bảng phí D12 cùng các mã cũ đang lưu; không tạo enum riêng ở frontend.
  vehicleTypes: async () => {
    const [rows] = await sequelize.query("SELECT DISTINCT VehicleType FROM DriverProfiles UNION SELECT DISTINCT VehicleType FROM Deliveries WHERE VehicleType IS NOT NULL UNION SELECT VehicleType FROM DeliveryFeeRules WHERE Status = 'ACTIVE'");
    return [...new Set(rows.map(r => r.VehicleType?.trim()).filter(Boolean))].sort();
  },
};
