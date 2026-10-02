'use strict';

const MINIMUM_ROWS = 10;
const requestedRows = Number.parseInt(process.env.SEED_RECORDS_PER_TABLE || '', 10);
const requestedBatchSize = Number.parseInt(process.env.SEED_BATCH_SIZE || '', 10);
const ROWS_PER_TABLE = Math.min(
  20,
  Math.max(
    MINIMUM_ROWS,
    Number.isFinite(requestedRows) ? requestedRows : 15
  )
);
const BATCH_SIZE = Math.min(
  10000,
  Math.max(1, Number.isFinite(requestedBatchSize) ? requestedBatchSize : 15)
);
const BASE_TIME = Date.parse('2026-01-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const pad = (value, length = 6) => String(value).padStart(length, '0');
const demoDate = (value, extraDays = 0) => new Date(BASE_TIME + ((value % 365) + extraDays) * DAY);
const nextId = (value) => (value === ROWS_PER_TABLE ? 1 : value + 1);

const TABLES = [
  {
    name: 'Users',
    row: (i) => ({
      UserId: i,
      Username: `user_${pad(i)}`,
      PasswordHash: 'demo_hash_not_for_production',
      FullName: `Người dùng ${pad(i)}`,
      Email: `user_${pad(i)}@example.local`,
      Phone: `09${String(i).padStart(8, '0')}`,
      GoogleId: null,
      AvatarUrl: `/demo/avatars/${i % 20}.png`,
      Address: `Địa chỉ minh họa số ${i}, Việt Nam`,
      EmailVerified: i % 3 !== 0,
      PhoneVerified: i % 4 !== 0,
      Status: i % 50 === 0 ? 'LOCKED' : 'ACTIVE',
      CreatedAt: demoDate(i),
      UpdatedAt: demoDate(i, 1)
    })
  },
  {
    name: 'Roles',
    row: (i) => ({
      RoleId: i,
      RoleName: ['USER', 'ADMIN', 'SELLER', 'DRIVER'][i - 1] || `ROLE_DEMO_${pad(i)}`,
      Description: `Vai trò dữ liệu mẫu số ${i}`
    })
  },
  {
    name: 'UserRoles',
    row: (i) => ({ UserId: i, RoleId: i, AssignedAt: demoDate(i) })
  },
  {
    name: 'VerificationCodes',
    row: (i) => ({
      VerificationId: i,
      UserId: i,
      Recipient: `user_${pad(i)}@example.local`,
      Channel: i % 2 === 0 ? 'EMAIL' : 'SMS',
      Purpose: ['REGISTER', 'VERIFY_PHONE', 'RESET_PASSWORD'][i % 3],
      CodeHash: `hashed_demo_code_${pad(i)}`,
      ExpiresAt: demoDate(i, 1),
      UsedAt: i % 2 === 0 ? demoDate(i) : null,
      CreatedAt: demoDate(i)
    })
  },
  {
    name: 'PartnerApplications',
    row: (i) => ({
      ApplicationId: i,
      UserId: i,
      PartnerType: i % 2 === 0 ? 'SELLER' : 'DRIVER',
      IdentityImageUrl: `/demo/identity/${pad(i)}.jpg`,
      IdentityNumberMasked: `***${String(i).slice(-4).padStart(4, '0')}`,
      Status: ['PENDING', 'APPROVED', 'REJECTED', 'NEED_INFO'][i % 4],
      ReviewNote: i % 4 === 2 ? 'Hồ sơ minh họa cần kiểm tra lại.' : null,
      ReviewedBy: i % 4 === 0 ? null : nextId(i),
      SubmittedAt: demoDate(i),
      ReviewedAt: i % 4 === 0 ? null : demoDate(i, 2)
    })
  },
  {
    name: 'Stores',
    row: (i) => ({
      StoreId: i,
      OwnerId: i,
      StoreName: `Gian hàng đồ cũ ${pad(i)}`,
      Description: `Gian hàng minh họa số ${i}`,
      Address: `${i} Đường Minh Họa, TP. Hồ Chí Minh`,
      Latitude: (10.7 + (i % 1000) / 10000).toFixed(7),
      Longitude: (106.6 + (i % 1000) / 10000).toFixed(7),
      IsDemoLocation: true,
      BankName: `Ngân hàng demo ${i % 10}`,
      BankAccountNumber: `1000${String(i).padStart(8, '0')}`,
      BankAccountHolder: `NGUOI DUNG ${pad(i)}`,
      QrImageUrl: `/demo/qr/${pad(i)}.png`,
      Status: i % 40 === 0 ? 'INACTIVE' : 'ACTIVE'
    })
  },
  {
    name: 'Categories',
    row: (i) => ({
      CategoryId: i,
      CategoryName: `Danh mục ${pad(i)}`,
      Description: `Danh mục dữ liệu minh họa số ${i}`,
      Status: i % 100 === 0 ? 'INACTIVE' : 'ACTIVE',
      CreatedAt: demoDate(i)
    })
  },
  {
    name: 'Listings',
    row: (i) => ({
      ListingId: i,
      SellerId: i,
      StoreId: i,
      CategoryId: i,
      Title: `Sản phẩm cũ minh họa ${pad(i)}`,
      Description: `Mô tả sản phẩm cũ số ${i}, dùng cho dữ liệu kiểm thử.`,
      Price: 50000 + (i % 5000) * 1000,
      ConditionLevel: ['LIKE_NEW', 'GOOD', 'FAIR', 'POOR'][i % 4],
      KnownDefects: i % 5 === 0 ? 'Có dấu hiệu sử dụng nhẹ.' : null,
      Location: `Khu vực ${i % 24}, TP. Hồ Chí Minh`,
      Status: ['ACTIVE', 'RESERVED', 'SOLD', 'PENDING'][i % 4],
      ModerationNote: null,
      CreatedAt: demoDate(i),
      UpdatedAt: demoDate(i, 1)
    })
  },
  {
    name: 'ListingMedia',
    row: (i) => ({
      MediaId: i,
      ListingId: i,
      MediaType: i % 10 === 0 ? 'VIDEO' : 'IMAGE',
      MediaUrl: `/demo/listings/${pad(i)}.${i % 10 === 0 ? 'mp4' : 'jpg'}`,
      SortOrder: 1,
      CreatedAt: demoDate(i)
    })
  },
  {
    name: 'Favorites',
    row: (i) => ({ UserId: i, ListingId: i, CreatedAt: demoDate(i) })
  },
  {
    name: 'ListingPromotions',
    row: (i) => ({
      PromotionId: i,
      ListingId: i,
      SellerId: i,
      PlanName: ['VIP_3_DAYS', 'VIP_7_DAYS', 'VIP_14_DAYS'][i % 3],
      FeeAmount: [20000, 40000, 70000][i % 3],
      PaymentReference: `VIP${pad(i)}`,
      PaymentProofUrl: `/demo/vip-proof/${pad(i)}.jpg`,
      Status: ['PENDING', 'ACTIVE', 'EXPIRED'][i % 3],
      StartsAt: demoDate(i),
      EndsAt: demoDate(i, 7),
      ConfirmedBy: i % 3 === 0 ? null : nextId(i),
      ConfirmedAt: i % 3 === 0 ? null : demoDate(i)
    })
  },
  {
    name: 'Orders',
    row: (i) => {
      const productAmount = 50000 + (i % 5000) * 1000;
      const deliveryFee = i % 2 === 0 ? 30000 : 0;
      return {
        OrderId: i,
        BuyerId: nextId(i),
        ListingId: i,
        SellerId: i,
        DeliveryMethod: i % 2 === 0 ? 'DELIVERY' : 'PICKUP',
        ReceiverName: `Người nhận ${pad(i)}`,
        ReceiverPhone: `08${String(i).padStart(8, '0')}`,
        ReceiverAddress: i % 2 === 0 ? `${i} Đường Giao Hàng, TP. Hồ Chí Minh` : null,
        ProductAmount: productAmount,
        DeliveryFee: deliveryFee,
        CommissionRate: 5,
        TotalAmount: productAmount + deliveryFee,
        Status: ['RESERVED', 'CONFIRMED', 'DELIVERING', 'COMPLETED'][i % 4],
        ReservedUntil: demoDate(i, 1),
        CancelReason: null,
        CreatedAt: demoDate(i),
        CompletedAt: i % 4 === 3 ? demoDate(i, 4) : null
      };
    }
  },
  {
    name: 'Payments',
    row: (i) => ({
      PaymentId: i,
      OrderId: i,
      PayerId: nextId(i),
      PayeeId: i,
      Amount: 50000 + (i % 5000) * 1000,
      BankName: `Ngân hàng demo ${i % 10}`,
      BankAccountSnapshot: `1000${String(i).padStart(8, '0')}`,
      TransferContent: `CHO DO CU DON ${pad(i)}`,
      ProofUrl: `/demo/payment-proof/${pad(i)}.jpg`,
      Status: ['WAITING', 'REPORTED', 'CONFIRMED', 'REJECTED'][i % 4],
      ReportedAt: demoDate(i),
      ConfirmedBy: i % 4 < 2 ? null : i,
      ConfirmedAt: i % 4 < 2 ? null : demoDate(i, 1)
    })
  },
  {
    name: 'RefundRequests',
    row: (i) => ({
      RefundRequestId: i,
      OrderId: i,
      RequestedBy: nextId(i),
      Reason: `Yêu cầu hoàn tiền minh họa số ${i}`,
      EvidenceUrl: `/demo/refund-evidence/${pad(i)}.jpg`,
      Amount: 50000 + (i % 5000) * 1000,
      RefundProofUrl: i % 3 === 0 ? `/demo/refund-proof/${pad(i)}.jpg` : null,
      Status: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'][i % 4],
      AdminNote: i % 4 === 2 ? 'Không đủ bằng chứng trong dữ liệu mẫu.' : null,
      ReviewedBy: i % 4 === 0 ? null : nextId(i),
      RequestedAt: demoDate(i),
      ReviewedAt: i % 4 === 0 ? null : demoDate(i, 1),
      CompletedAt: i % 4 === 3 ? demoDate(i, 3) : null
    })
  },
  {
    name: 'Commissions',
    row: (i) => {
      const originalAmount = (50000 + (i % 5000) * 1000) * 0.05;
      const adjustment = i % 20 === 0 ? -5000 : 0;
      return {
        CommissionId: i,
        OrderId: i,
        SellerId: i,
        Rate: 5,
        OriginalAmount: originalAmount,
        AdjustmentAmount: adjustment,
        AmountDue: Math.max(0, originalAmount + adjustment),
        PaymentReference: `HH${pad(i)}`,
        PaymentProofUrl: `/demo/commission-proof/${pad(i)}.jpg`,
        Status: ['UNPAID', 'REPORTED', 'PAID', 'ADJUSTED'][i % 4],
        DueAt: demoDate(i, 10),
        ConfirmedBy: i % 4 < 2 ? null : nextId(i),
        ConfirmedAt: i % 4 < 2 ? null : demoDate(i, 2)
      };
    }
  },
  {
    name: 'Deliveries',
    row: (i) => ({
      DeliveryId: i,
      OrderId: i,
      DriverId: nextId(i),
      PickupAddress: `${i} Đường Lấy Hàng, TP. Hồ Chí Minh`,
      DeliveryAddress: `${i} Đường Giao Hàng, TP. Hồ Chí Minh`,
      DriverFee: 30000,
      PickupCodeHash: `hashed_pickup_${pad(i)}`,
      Status: ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'FAILED'][i % 5],
      RetryCount: i % 3,
      FailureReason: i % 5 === 4 ? 'Không liên hệ được người nhận.' : null,
      ProofUrl: `/demo/delivery-proof/${pad(i)}.jpg`,
      AcceptedAt: i % 5 === 0 ? null : demoDate(i),
      PickedUpAt: i % 5 < 2 ? null : demoDate(i, 1),
      DeliveredAt: i % 5 === 3 ? demoDate(i, 2) : null,
      ReturnedAt: i % 5 === 4 ? demoDate(i, 3) : null
    })
  },
  {
    name: 'StatusHistories',
    row: (i) => ({
      HistoryId: i,
      OrderId: i,
      DeliveryId: i,
      StatusType: ['ORDER', 'PAYMENT', 'REFUND', 'DELIVERY'][i % 4],
      StatusValue: ['CONFIRMED', 'REPORTED', 'APPROVED', 'DELIVERING'][i % 4],
      Note: `Lịch sử trạng thái minh họa số ${i}`,
      ChangedBy: nextId(i),
      CreatedAt: demoDate(i)
    })
  },
  {
    name: 'Conversations',
    row: (i) => ({
      ConversationId: i,
      ListingId: i,
      OrderId: i,
      CreatedBy: nextId(i),
      ConversationType: i % 5 === 0 ? 'AI_SUPPORT' : 'DIRECT_CHAT',
      CreatedAt: demoDate(i),
      LastMessageAt: demoDate(i, 1)
    })
  },
  {
    name: 'Messages',
    row: (i) => ({
      MessageId: i,
      ConversationId: i,
      SenderId: i % 5 === 0 ? null : nextId(i),
      SenderType: i % 5 === 0 ? 'AI' : 'USER',
      Content: `Tin nhắn dữ liệu mẫu số ${i}`,
      IsRead: i % 2 === 0,
      SentAt: demoDate(i)
    })
  },
  {
    name: 'Reviews',
    row: (i) => ({
      ReviewId: i,
      OrderId: i,
      ReviewerId: nextId(i),
      TargetUserId: i,
      TargetType: i % 2 === 0 ? 'SELLER' : 'DRIVER',
      Rating: (i % 5) + 1,
      Comment: `Đánh giá minh họa số ${i}`,
      Reply: i % 3 === 0 ? `Phản hồi minh họa số ${i}` : null,
      CreatedAt: demoDate(i),
      ReplyAt: i % 3 === 0 ? demoDate(i, 1) : null
    })
  },
  {
    name: 'Reports',
    row: (i) => ({
      ReportId: i,
      ReporterId: nextId(i),
      ListingId: i,
      ReportedUserId: i,
      OrderId: i,
      Reason: ['Sai mô tả', 'Nghi ngờ lừa đảo', 'Sản phẩm cấm'][i % 3],
      Description: `Nội dung báo cáo minh họa số ${i}`,
      EvidenceUrl: `/demo/report-evidence/${pad(i)}.jpg`,
      Status: ['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'][i % 4],
      HandledBy: i % 4 === 0 ? null : nextId(i),
      Resolution: i % 4 === 2 ? 'Đã xử lý dữ liệu báo cáo mẫu.' : null,
      CreatedAt: demoDate(i),
      HandledAt: i % 4 < 2 ? null : demoDate(i, 2)
    })
  },
  {
    name: 'Notifications',
    row: (i) => ({
      NotificationId: i,
      UserId: i,
      Type: ['MESSAGE', 'ORDER', 'PARTNER', 'LISTING', 'VIP', 'SYSTEM'][i % 6],
      Title: `Thông báo ${pad(i)}`,
      Message: `Nội dung thông báo dữ liệu mẫu số ${i}`,
      ReferenceType: i % 2 === 0 ? 'ORDER' : 'LISTING',
      ReferenceId: i,
      IsRead: i % 2 === 0,
      CreatedAt: demoDate(i)
    })
  }
];

async function insertInBatches(queryInterface, table) {
  process.stdout.write(`\n[Seeder] ${table.name}: `);
  for (let start = 1; start <= ROWS_PER_TABLE; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, ROWS_PER_TABLE);
    const rows = [];
    for (let i = start; i <= end; i += 1) {
      rows.push(table.row(i));
    }
    await queryInterface.bulkInsert(table.name, rows, { logging: false });
    process.stdout.write(`${end}/${ROWS_PER_TABLE} `);
  }
  process.stdout.write('✓');
}

module.exports = {
  async up(queryInterface) {
    console.log(
      `[Seeder] Tạo ${ROWS_PER_TABLE.toLocaleString('vi-VN')} dòng cho mỗi bảng, ` +
      `${TABLES.length} bảng, lô ${BATCH_SIZE.toLocaleString('vi-VN')} dòng.`
    );

    const [existing] = await queryInterface.sequelize.query('SELECT COUNT(*) AS total FROM `Users`');
    if (Number(existing[0].total) > 0) {
      throw new Error(
        'Cơ sở dữ liệu đã có dữ liệu. Hãy chạy npm run db:seed:undo hoặc tạo database mới trước khi seed.'
      );
    }

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of TABLES) {
        await insertInBatches(queryInterface, table);
      }
    } finally {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`\n[Seeder] Hoàn tất ${TABLES.length * ROWS_PER_TABLE} bản ghi.`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of [...TABLES].reverse()) {
        await queryInterface.bulkDelete(table.name, null, { truncate: true });
      }
    } finally {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }
};

module.exports.TABLE_NAMES = TABLES.map((table) => table.name);
module.exports.ROWS_PER_TABLE = ROWS_PER_TABLE;
