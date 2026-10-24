'use strict';

// Không tạo tài xế AVAILABLE, báo giá hay dấu chuẩn bị hàng cho dữ liệu cũ.
// C07/D12 phải ghi snapshot đáng tin cậy qua điểm tích hợp server trước D07.
module.exports = {
  async up(q, S) {
    const tables = await q.showAllTables();
    if (!tables.includes('DriverProfiles')) await q.createTable('DriverProfiles', {
      DriverProfileId: { type: S.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      UserId: { type: S.INTEGER.UNSIGNED, allowNull: false, unique: true, references: { model: 'Users', key: 'UserId' } },
      VehicleType: { type: S.STRING(30), allowNull: false },
      VehiclePlate: { type: S.STRING(20), allowNull: false },
      ServiceArea: { type: S.STRING(255), allowNull: false },
      MaxDistanceKm: { type: S.DECIMAL(6, 2), allowNull: true },
      BankName: { type: S.STRING(80), allowNull: true },
      BankAccountNumber: { type: S.STRING(30), allowNull: true },
      BankAccountHolder: { type: S.STRING(100), allowNull: true },
      QrImageUrl: { type: S.STRING(255), allowNull: true },
      AvailabilityStatus: { type: S.STRING(20), allowNull: false, defaultValue: 'OFFLINE' },
      UpdatedAt: { type: S.DATE, allowNull: true },
    });
    const columns = {
      // Nullable: chưa có C07/D12 thì không suy diễn từ PAID hoặc chuỗi địa chỉ.
      ReadyForPickupAt: { type: S.DATE, allowNull: true },
      PreparedBy: { type: S.INTEGER.UNSIGNED, allowNull: true, references: { model: 'Users', key: 'UserId' } },
      PickupArea: { type: S.STRING(100), allowNull: true },
      DeliveryArea: { type: S.STRING(100), allowNull: true },
      VehicleType: { type: S.STRING(30), allowNull: true },
      RouteDistanceKm: { type: S.DECIMAL(8, 2), allowNull: true },
    };
    // MySQL DDL auto-commit: chạy lại an toàn nếu lần trước ngắt giữa các cột.
    const existing = await q.describeTable('Deliveries');
    for (const [name, definition] of Object.entries(columns)) if (!existing[name]) await q.addColumn('Deliveries', name, definition);
    const indexes = await q.showIndex('Deliveries');
    if (!indexes.some(index => index.name === 'IX_Deliveries_D07Available')) await q.addIndex('Deliveries', ['Status', 'DriverId', 'DeliveryId'], { name: 'IX_Deliveries_D07Available' });
  },
  async down() {
    // Rollback tự động có thể làm mất snapshot và hồ sơ vận hành: cần migration riêng.
    throw new Error('D07 giữ dữ liệu: không tự xóa bảng/cột đã sử dụng.');
  },
};
