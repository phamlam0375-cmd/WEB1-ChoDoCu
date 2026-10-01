"use strict";

// B08 — Hoa hồng theo đơn; B09 — Thu và đối soát phí website.
const { Op, fn, col } = require("sequelize");
const { sequelize, Commissions, Orders, Users, Listings } = require("../models");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const {
  parsePagination,
  pagedResponse,
  parseId,
  optionalId,
  text,
  oneOf,
  optionalUrl,
  parseDate,
} = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { getSettingsMap } = require("../services/settings.service");
const {
  OUTSTANDING_STATUSES,
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
  if (query.status) where.Status = oneOf(query.status, COMMISSION_STATUSES, "Trạng thái");
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

// GET /admin/commissions — B08: toàn bộ hoa hồng theo đơn.
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

// GET /seller/commissions — B08: người bán xem hoa hồng từng đơn của mình.
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

// GET /seller/fee-payments — B09: phí còn nợ + tài khoản nhận phí của website.
const getSellerFeeOverview = async (req, res) => {
  const [settings, debt, items] = await Promise.all([
    getSettingsMap(),
    getSellerDebt(req.user.UserId),
    Commissions.findAll({
      where: { SellerId: req.user.UserId, Status: OUTSTANDING_STATUSES },
      attributes: { exclude: ["ConfirmedBy"] },
      include: [orderInclude],
      order: [["DueAt", "ASC"], ["CommissionId", "ASC"]],
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      bankAccount: {
        bankName: settings.FEE_BANK_NAME,
        accountNumber: settings.FEE_BANK_ACCOUNT_NUMBER,
        accountHolder: settings.FEE_BANK_ACCOUNT_HOLDER,
      },
      summary: debt,
      items: items.map(withOverdue),
    },
  });
};

// POST /seller/fee-payments { commissionIds: [], proofUrl } — B09: người bán báo đã nộp.
const reportFeePayment = async (req, res) => {
  const ids = Array.isArray(req.body.commissionIds)
    ? [...new Set(req.body.commissionIds.map((value) => parseId(value, "Mã khoản phí")))]
    : [];
  if (!ids.length) throw badRequest("Vui lòng chọn ít nhất một khoản phí");
  if (ids.length > 50) throw badRequest("Mỗi lần báo nộp tối đa 50 khoản");
  const proofUrl = optionalUrl(req.body.proofUrl, "Ảnh chứng minh chuyển khoản");
  if (!proofUrl) throw badRequest("Vui lòng cung cấp ảnh chứng minh chuyển khoản");

  const items = await sequelize.transaction(async (transaction) => {
    const rows = await Commissions.findAll({
      where: { CommissionId: ids, SellerId: req.user.UserId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (rows.length !== ids.length) throw notFound("Có khoản phí không tồn tại hoặc không thuộc về bạn");
    const invalid = rows.filter((row) => !PAYABLE_STATUSES.includes(row.Status));
    if (invalid.length) {
      throw conflict(`Các khoản ${invalid.map((row) => row.PaymentReference).join(", ")} không ở trạng thái chờ nộp`);
    }
    for (const row of rows) {
      await row.update({ Status: "REPORTED", PaymentProofUrl: proofUrl }, { transaction });
    }
    return rows;
  });

  const total = items.reduce((sum, row) => sum + Number(row.AmountDue), 0);
  return res.status(200).json({
    success: true,
    message: `Đã báo nộp ${items.length} khoản, tổng ${total.toLocaleString("vi-VN")}đ. Quản trị viên sẽ đối soát và xác nhận.`,
    data: items,
  });
};

// GET /admin/fee-payments — B09: mặc định các khoản người bán đã báo nộp, chờ đối soát.
const listFeePayments = (req, res) => {
  const query = { ...req.query, status: req.query.status || (req.query.overdue === "true" ? undefined : "REPORTED") };
  if (query.status === "ALL") delete query.status;
  return respondCommissionList(res, query);
};

// GET /admin/fee-payments/debtors — người bán đang nợ phí, sắp theo số nợ.
const listDebtors = async (req, res) => {
  const pagination = parsePagination(req.query);
  const settings = await getSettingsMap();
  const now = new Date();

  const [rows, countRows] = await Promise.all([
    sequelize.query(
      `SELECT c.SellerId, u.FullName, u.Email, u.Phone,
              SUM(CASE WHEN c.Status IN ('UNPAID','ADJUSTED') THEN c.AmountDue ELSE 0 END) AS Unpaid,
              SUM(CASE WHEN c.Status = 'REPORTED' THEN c.AmountDue ELSE 0 END) AS Reported,
              SUM(CASE WHEN c.Status IN ('UNPAID','ADJUSTED') AND c.DueAt < :now THEN 1 ELSE 0 END) AS OverdueCount,
              COUNT(*) AS ItemCount
         FROM Commissions c JOIN Users u ON u.UserId = c.SellerId
        WHERE c.Status IN ('UNPAID','ADJUSTED','REPORTED')
        GROUP BY c.SellerId, u.FullName, u.Email, u.Phone
        ORDER BY Unpaid DESC, c.SellerId ASC
        LIMIT :limit OFFSET :offset`,
      { replacements: { now, limit: pagination.limit, offset: pagination.offset }, type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      "SELECT COUNT(DISTINCT SellerId) AS total FROM Commissions WHERE Status IN ('UNPAID','ADJUSTED','REPORTED')",
      { type: sequelize.QueryTypes.SELECT }
    ),
  ]);

  const data = rows.map((row) => ({
    ...row,
    Unpaid: Number(row.Unpaid),
    Reported: Number(row.Reported),
    OverdueCount: Number(row.OverdueCount),
    ItemCount: Number(row.ItemCount),
    OverLimit: Number(row.Unpaid) > settings.SELLER_DEBT_LIMIT,
  }));
  return pagedResponse(res, { rows: data, count: Number(countRows[0].total) }, pagination, {
    debtLimit: settings.SELLER_DEBT_LIMIT,
  });
};

const FEE_ACTIONS = {
  CONFIRM: { from: ["UNPAID", "ADJUSTED", "REPORTED"], audit: "FEE_CONFIRM", noteRequired: false },
  REJECT: { from: ["REPORTED"], audit: "FEE_REJECT", noteRequired: true },
  WAIVE: { from: ["UNPAID", "ADJUSTED", "REPORTED"], audit: "FEE_WAIVE", noteRequired: true },
};

// PATCH /admin/fee-payments/:id { action: CONFIRM | REJECT | WAIVE, note }
const reviewFeePayment = async (req, res) => {
  const id = parseId(req.params.id, "Mã khoản phí");
  const action = oneOf(req.body.action, Object.keys(FEE_ACTIONS), "Hành động");
  const rule = FEE_ACTIONS[action];
  const note = text(req.body.note, "ghi chú", { required: rule.noteRequired, min: 5, max: 500 });

  const commission = await sequelize.transaction(async (transaction) => {
    const item = await Commissions.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy khoản phí");
    if (!rule.from.includes(item.Status)) {
      throw conflict(`Khoản phí đang ở trạng thái ${item.Status}, không thể thực hiện thao tác này`);
    }

    const before = { Status: item.Status, AmountDue: Number(item.AmountDue), PaymentProofUrl: item.PaymentProofUrl };
    let changes;
    if (action === "CONFIRM") {
      changes = { Status: "PAID", ConfirmedBy: req.user.UserId, ConfirmedAt: new Date() };
    } else if (action === "REJECT") {
      changes = { Status: Number(item.AdjustmentAmount) !== 0 ? "ADJUSTED" : "UNPAID", PaymentProofUrl: null };
    } else {
      changes = { Status: "WAIVED", ConfirmedBy: req.user.UserId, ConfirmedAt: new Date() };
    }
    await item.update(changes, { transaction });

    await logAdminAction(
      req,
      {
        action: rule.audit,
        targetType: "COMMISSION",
        targetId: id,
        oldValue: before,
        newValue: { Status: item.Status, AmountDue: Number(item.AmountDue), OrderId: item.OrderId, PaymentReference: item.PaymentReference },
        note,
      },
      { transaction }
    );

    const amount = `${Number(item.AmountDue).toLocaleString("vi-VN")}đ`;
    const messages = {
      CONFIRM: ["Đã xác nhận thu phí", `Website đã nhận ${amount} cho khoản ${item.PaymentReference}.`],
      REJECT: ["Chưa đối soát được khoản phí", `Khoản ${item.PaymentReference} (${amount}): ${note}. Vui lòng kiểm tra và báo nộp lại.`],
      WAIVE: ["Khoản phí được miễn", `Khoản ${item.PaymentReference} đã được miễn. ${note}`],
    };
    await notify(
      item.SellerId,
      {
        type: "PAYMENT",
        title: messages[action][0],
        message: messages[action][1],
        referenceType: "COMMISSION",
        referenceId: id,
      },
      { transaction }
    );
    return item;
  });

  const fresh = await Commissions.findByPk(commission.CommissionId, { include: [orderInclude, sellerInclude, confirmerInclude] });
  return res.status(200).json({ success: true, message: "Đã cập nhật khoản phí", data: withOverdue(fresh) });
};

module.exports = {
  listCommissions,
  syncCommissions,
  listSellerCommissions,
  getSellerFeeOverview,
  reportFeePayment,
  listFeePayments,
  listDebtors,
  reviewFeePayment,
};
