"use strict";

const { Op, fn, col } = require("sequelize");
const { sequelize, Orders, Commissions } = require("../models");
const { badRequest, notFound } = require("../utils/httpError");
const { getSetting, getSettingAt } = require("./settings.service");

const DAY_MS = 24 * 60 * 60 * 1000;

// Khoản còn phải nộp (REPORTED là đã báo nộp nhưng admin chưa xác nhận).
const OUTSTANDING_STATUSES = ["UNPAID", "ADJUSTED", "REPORTED"];
const PAYABLE_STATUSES = ["UNPAID", "ADJUSTED"];

const roundVnd = (value) => Math.round(Number(value));

// Mã nội dung chuyển khoản để admin đối soát với sao kê ngân hàng.
const paymentReference = (orderId) => `HH${String(orderId).padStart(6, "0")}`;

// B08: ghi khoản hoa hồng phải nộp cho một đơn đã hoàn tất, đúng MỘT lần.
// Thành viên D gọi hàm này ngay khi đơn chuyển sang COMPLETED; gọi lại nhiều lần
// vẫn an toàn (OrderId là UNIQUE, trả về khoản đã có).
const createCommissionForOrder = async (orderId, { transaction } = {}) => {
  const order = await Orders.findByPk(orderId, { transaction });
  if (!order) throw notFound("Không tìm thấy đơn hàng");
  if (order.Status !== "COMPLETED") {
    throw badRequest("Chỉ tính hoa hồng cho đơn đã hoàn tất");
  }

  const existing = await Commissions.findOne({ where: { OrderId: order.OrderId }, transaction });
  if (existing) return { commission: existing, created: false };

  // Tỷ lệ đã chốt trên đơn; đơn cũ chưa lưu tỷ lệ thì lấy cấu hình có hiệu lực lúc đặt đơn.
  const rate = Number(order.CommissionRate) > 0
    ? Number(order.CommissionRate)
    : await getSettingAt("COMMISSION_RATE", order.CreatedAt, { transaction });
  const originalAmount = roundVnd((Number(order.ProductAmount) * rate) / 100);
  const dueDays = await getSetting("COMMISSION_DUE_DAYS", { transaction });
  const baseDate = order.CompletedAt || new Date();

  try {
    const commission = await Commissions.create(
      {
        OrderId: order.OrderId,
        SellerId: order.SellerId,
        Rate: rate,
        OriginalAmount: originalAmount,
        AdjustmentAmount: 0,
        AmountDue: originalAmount,
        PaymentReference: paymentReference(order.OrderId),
        Status: originalAmount > 0 ? "UNPAID" : "WAIVED",
        DueAt: new Date(new Date(baseDate).getTime() + dueDays * DAY_MS),
      },
      { transaction }
    );
    return { commission, created: true };
  } catch (error) {
    // Hai yêu cầu cùng lúc: bên thua đọc lại khoản bên kia vừa tạo.
    if (error.name === "SequelizeUniqueConstraintError") {
      const commission = await Commissions.findOne({ where: { OrderId: order.OrderId }, transaction });
      return { commission, created: false };
    }
    throw error;
  }
};

// Tạo hoa hồng cho các đơn đã hoàn tất nhưng chưa có khoản nào (đơn cũ, hoặc lúc
// hoàn tất đơn chưa gọi được createCommissionForOrder).
const createMissingCommissions = async (limit = 500) => {
  const orders = await Orders.findAll({
    attributes: ["OrderId"],
    where: {
      Status: "COMPLETED",
      OrderId: { [Op.notIn]: sequelize.literal("(SELECT `OrderId` FROM `Commissions`)") },
    },
    limit,
    order: [["OrderId", "ASC"]],
  });

  let created = 0;
  for (const order of orders) {
    const result = await createCommissionForOrder(order.OrderId);
    if (result.created) created += 1;
  }
  return { checked: orders.length, created };
};

// B07: điều chỉnh hoa hồng khi hoàn tiền xong, theo tỷ lệ tiền hoàn / giá sản phẩm.
// Khoản đã thu hoặc đã miễn thì không tự sửa, trả về ghi chú để admin đối soát tay.
const adjustCommissionForRefund = async (order, refundAmount, { transaction }) => {
  const commission = await Commissions.findOne({
    where: { OrderId: order.OrderId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!commission) return { commission: null, changed: false };

  if (["PAID", "WAIVED"].includes(commission.Status)) {
    return {
      commission,
      changed: false,
      note: `Hoa hồng đơn #${order.OrderId} đã ở trạng thái ${commission.Status} trước khi hoàn tiền, cần đối soát thủ công.`,
    };
  }

  const original = Number(commission.OriginalAmount);
  const ratio = Math.min(1, Number(refundAmount) / Number(order.ProductAmount || 1));
  const adjustment = Math.max(-original, Number(commission.AdjustmentAmount) - roundVnd(original * ratio));
  const amountDue = Math.max(0, original + adjustment);

  const before = { Status: commission.Status, AdjustmentAmount: Number(commission.AdjustmentAmount), AmountDue: Number(commission.AmountDue) };
  await commission.update(
    {
      AdjustmentAmount: adjustment,
      AmountDue: amountDue,
      Status: amountDue === 0 ? "WAIVED" : "ADJUSTED",
    },
    { transaction }
  );
  return { commission, changed: true, before };
};

// Tổng phí người bán còn nợ; overLimit dựa trên khoản chưa báo nộp.
const getSellerDebt = async (sellerId, { transaction } = {}) => {
  const rows = await Commissions.findAll({
    attributes: ["Status", [fn("SUM", col("AmountDue")), "total"], [fn("COUNT", col("CommissionId")), "count"]],
    where: { SellerId: sellerId, Status: OUTSTANDING_STATUSES },
    group: ["Status"],
    raw: true,
    transaction,
  });
  const overdueCount = await Commissions.count({
    where: { SellerId: sellerId, Status: PAYABLE_STATUSES, DueAt: { [Op.lt]: new Date() } },
    transaction,
  });

  const sumOf = (statuses) =>
    rows.filter((row) => statuses.includes(row.Status)).reduce((total, row) => total + Number(row.total || 0), 0);
  const unpaid = sumOf(PAYABLE_STATUSES);
  const reported = sumOf(["REPORTED"]);
  const debtLimit = await getSetting("SELLER_DEBT_LIMIT", { transaction });

  return {
    unpaid,
    reported,
    outstanding: unpaid + reported,
    overdueCount,
    debtLimit,
    overLimit: unpaid > debtLimit,
  };
};

// Dành cho thành viên C (đăng tin): kiểm tra người bán có đang nợ phí quá ngưỡng.
const isSellerOverDebtLimit = async (sellerId) => (await getSellerDebt(sellerId)).overLimit;

module.exports = {
  OUTSTANDING_STATUSES,
  PAYABLE_STATUSES,
  paymentReference,
  createCommissionForOrder,
  createMissingCommissions,
  adjustCommissionForRefund,
  getSellerDebt,
  isSellerOverDebtLimit,
};
