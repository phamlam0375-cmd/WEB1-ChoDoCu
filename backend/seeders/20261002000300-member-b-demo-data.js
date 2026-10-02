'use strict';

// Dữ liệu demo cho phân hệ quản trị và doanh thu (chạy sau seeder dữ liệu mẫu chung):
//  - Hồ sơ đối tác của tài khoản #4 và #8 (đang Chờ duyệt) được xác thực đủ email và số điện thoại
//    để demo bấm Duyệt thành công.
//  - Hai đơn vừa hoàn tất, đã thanh toán, có sẵn khoản hoa hồng: dùng để demo gửi yêu cầu hoàn tiền
//    (người mua #1 và #4) và nộp phí (người bán #3).
// Chạy riêng: npx sequelize-cli db:seed --seed 20261002000300-member-b-demo-data.js

const DAY = 24 * 60 * 60 * 1000;
const VERIFIED_APPLICANTS = [4, 8];
const DEMO_ORDERS = [
  { OrderId: 9001, BuyerId: 1, SellerId: 3, ListingId: 3, ProductAmount: 2500000 },
  { OrderId: 9002, BuyerId: 4, SellerId: 3, ListingId: 3, ProductAmount: 1200000 },
];
const ORDER_IDS = DEMO_ORDERS.map((order) => order.OrderId);
const RATE = 5;

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkUpdate(
      'Users',
      { EmailVerified: true, PhoneVerified: true, UpdatedAt: now },
      { UserId: VERIFIED_APPLICANTS }
    );

    await queryInterface.bulkInsert(
      'Orders',
      DEMO_ORDERS.map((order) => ({
        ...order,
        DeliveryMethod: 'PICKUP',
        ReceiverName: `Người mua demo #${order.BuyerId}`,
        ReceiverPhone: `0912${String(order.OrderId).padStart(6, '0')}`,
        ReceiverAddress: null,
        DeliveryFee: 0,
        CommissionRate: RATE,
        TotalAmount: order.ProductAmount,
        Status: 'COMPLETED',
        ReservedUntil: new Date(now.getTime() - DAY),
        CancelReason: null,
        CreatedAt: new Date(now.getTime() - 2 * DAY),
        CompletedAt: now,
      }))
    );

    await queryInterface.bulkInsert(
      'Payments',
      DEMO_ORDERS.map((order) => ({
        OrderId: order.OrderId,
        PayerId: order.BuyerId,
        PayeeId: order.SellerId,
        Amount: order.ProductAmount,
        BankName: 'Vietcombank',
        BankAccountSnapshot: '1000000003',
        TransferContent: `CHO DO CU DON ${order.OrderId}`,
        ProofUrl: null,
        Status: 'CONFIRMED',
        ReportedAt: new Date(now.getTime() - 2 * DAY),
        ConfirmedBy: order.SellerId,
        ConfirmedAt: new Date(now.getTime() - DAY),
      }))
    );

    await queryInterface.bulkInsert(
      'Commissions',
      DEMO_ORDERS.map((order) => {
        const amount = Math.round((order.ProductAmount * RATE) / 100);
        return {
          OrderId: order.OrderId,
          SellerId: order.SellerId,
          Rate: RATE,
          OriginalAmount: amount,
          AdjustmentAmount: 0,
          AmountDue: amount,
          PaymentReference: `HH${String(order.OrderId).padStart(6, '0')}`,
          PaymentProofUrl: null,
          Status: 'UNPAID',
          DueAt: new Date(now.getTime() + 7 * DAY),
          ConfirmedBy: null,
          ConfirmedAt: null,
        };
      })
    );
  },

  async down(queryInterface) {
    // Xóa dữ liệu phát sinh khi demo trên các đơn này trước, rồi tới chính các đơn.
    for (const table of ['StatusHistories', 'RefundRequests', 'Reports', 'Commissions', 'Payments']) {
      await queryInterface.bulkDelete(table, { OrderId: ORDER_IDS });
    }
    await queryInterface.bulkDelete('Orders', { OrderId: ORDER_IDS });
    // Trả lại trạng thái xác thực như dữ liệu mẫu chung (số điện thoại chưa xác thực).
    await queryInterface.bulkUpdate('Users', { PhoneVerified: false }, { UserId: VERIFIED_APPLICANTS });
  },
};
