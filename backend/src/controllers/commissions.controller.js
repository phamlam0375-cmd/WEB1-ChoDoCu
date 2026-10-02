"use strict";

// Hoa hồng theo đơn: quản trị xem toàn bộ, người bán xem hoa hồng các đơn của mình.
const { Op, fn, col } = require("sequelize");
const { Commissions, Orders, Users, Listings } = require("../models");
const {
  parsePagination,
  pagedResponse,
  optionalId,
  text,
  oneOf,
  parseDate,
} = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");
const {
  PAYABLE_STATUSES,
  createMissingCommissions,
  getSellerDebt,
} = require("../services/commission.service");

const COMMISSION_STATUSES = ["UNPAID", "REPORTED", "PAID", "ADJUSTED", "WAIVED"];

const orderInclude = {
  model: Orders,
  as: "Order",
  attributes: ["OrderId", "ProductAmount", "Status", "CreatedAt", "CompletedAt"],
  include: [{ model: Listings, as: "Listing", attributes: ["ListingId", "Title"] }],
};
const sellerInclude = { model: Users, as: "Seller", attributes: ["UserId", "FullName", "Email", "Phone"] };
const confirmerInclude = { model: Users, as: "Confirmer", attributes: ["UserId", "FullName"] };

const withOverdue = (commission) => {
  const plain = commission.get({ plain: true });
  const isOverdue = PAYABLE_STATUSES.includes(plain.Status) && plain.DueAt && new Date(plain.DueAt) < new Date();
  return { ...plain, IsOverdue: Boolean(isOverdue) };
};

const statusTotals = async (where = {}) => {
  const rows = await Commissions.findAll({
    attributes: ["Status", [fn("COUNT", col("CommissionId")), "count"], [fn("SUM", col("AmountDue")), "amount"]],
    where,
    group: ["Status"],
    raw: true,
  });
  return Object.fromEntries(rows.map((row) => [row.Status, { count: Number(row.count), amount: Number(row.amount || 0) }]));
};

const buildAdminWhere = (query) => {
  const where = {};
  // Cho phép lọc nhiều trạng thái: ?status=UNPAID,ADJUSTED (nhóm "Còn nợ").
  if (query.status) {
    where.Status = String(query.status).split(",").map((status) => oneOf(status.trim(), COMMISSION_STATUSES, "Trạng thái"));
  }
  const sellerId = optionalId(query.sellerId, "Mã người bán");
  if (sellerId) where.SellerId = sellerId;
  if (query.overdue === "true") {
    where.Status = PAYABLE_STATUSES;
    where.DueAt = { [Op.lt]: new Date() };
  }
  const from = parseDate(query.from, "Từ ngày");
  const to = parseDate(query.to, "Đến ngày", { endOfDay: true });
  if (from || to) where["$Order.CompletedAt$"] = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };

  const q = text(query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [
      { PaymentReference: like },
      { "$Seller.FullName$": like },
      ...(/^\d+$/.test(q) ? [{ OrderId: Number(q) }, { CommissionId: Number(q) }] : []),
    ];
  }
  return where;
};

const respondCommissionList = async (res, query) => {
  const pagination = parsePagination(query);
  const where = buildAdminWhere(query);

  const [result, totals] = await Promise.all([
    Commissions.findAndCountAll({
      where,
      include: [orderInclude, sellerInclude, confirmerInclude],
      order: [["CommissionId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
    }),
    statusTotals(),
  ]);

  return pagedResponse(res, { rows: result.rows.map(withOverdue), count: result.count }, pagination, { totals });
};

// GET /admin/commissions — toàn bộ hoa hồng theo đơn.
const listCommissions = (req, res) => respondCommissionList(res, req.query);

// POST /admin/commissions/sync — tạo hoa hồng cho đơn hoàn tất còn thiếu.
const syncCommissions = async (req, res) => {
  const result = await createMissingCommissions();
  if (result.created > 0) {
    await logAdminAction(req, {
      action: "COMMISSION_SYNC",
      targetType: "COMMISSION",
      newValue: result,
      note: `Tạo ${result.created} khoản hoa hồng cho đơn đã hoàn tất`,
    });
  }
  return res.status(200).json({
    success: true,
    message: result.created
      ? `Đã tạo ${result.created} khoản hoa hồng mới`
      : "Mọi đơn đã hoàn tất đều đã có khoản hoa hồng",
    data: result,
  });
};

// GET /seller/commissions — người bán xem hoa hồng từng đơn của mình.
const listSellerCommissions = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = { SellerId: req.user.UserId };
  if (req.query.status) where.Status = oneOf(req.query.status, COMMISSION_STATUSES, "Trạng thái");

  const [result, debt] = await Promise.all([
    Commissions.findAndCountAll({
      where,
      attributes: { exclude: ["ConfirmedBy"] },
      include: [orderInclude],
      order: [["CommissionId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    getSellerDebt(req.user.UserId),
  ]);
  return pagedResponse(res, { rows: result.rows.map(withOverdue), count: result.count }, pagination, { summary: debt });
};

module.exports = {
  listCommissions,
  syncCommissions,
  listSellerCommissions,
};
