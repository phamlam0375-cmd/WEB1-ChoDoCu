"use strict";

// Hoa hồng theo đơn; thu và đối soát phí website.
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
const { BANK_BY_CODE } = require("../utils/banks");
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

// Mã đối soát của người bán, dùng làm nội dung chuyển khoản khi nộp nhiều khoản một lần.
const sellerReference = (sellerId) => `PHI${String(sellerId).padStart(6, "0")}`;

// GET /seller/fee-payments — phí còn nợ + tài khoản nhận phí của website (để tạo mã QR).
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
  const bank = BANK_BY_CODE[settings.FEE_BANK_CODE];

  return res.status(200).json({
    success: true,
    data: {
      bankAccount: {
        bankCode: settings.FEE_BANK_CODE,
        bankName: bank ? bank.shortName : settings.FEE_BANK_CODE,
        accountNumber: settings.FEE_BANK_ACCOUNT_NUMBER,
        accountHolder: settings.FEE_BANK_ACCOUNT_HOLDER,
      },
      sellerReference: sellerReference(req.user.UserId),
      summary: debt,
      items: items.map(withOverdue),
    },
  });
};

// POST /seller/fee-payments { commissionIds: [], amount, transactionCode, proofUrl? } — người bán báo đã nộp.
const reportFeePayment = async (req, res) => {
  const ids = Array.isArray(req.body.commissionIds)
    ? [...new Set(req.body.commissionIds.map((value) => parseId(value, "Mã khoản phí")))]
    : [];
  if (!ids.length) throw badRequest("Vui lòng chọn ít nhất một khoản phí");
  if (ids.length > 50) throw badRequest("Mỗi lần báo nộp tối đa 50 khoản");
  const transactionCode = text(req.body.transactionCode, "mã giao dịch", { max: 50 });
  if (!transactionCode) throw badRequest("Vui lòng nhập mã giao dịch");
  const amount = Number(req.body.amount);
  const proofUrl = optionalUrl(req.body.proofUrl, "Ảnh chứng minh chuyển khoản");

  const items = await sequelize.transaction(async (transaction) => {
    const rows = await Commissions.findAll({
      where: { CommissionId: ids, SellerId: req.user.UserId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (rows.length !== ids.length) throw notFound("Có khoản phí không tồn tại hoặc không thuộc về bạn");
    const invalid = rows.filter((row) => !PAYABLE_STATUSES.includes(row.Status));
    if (invalid.length) {
      throw conflict(`Các khoản ${invalid.map((row) => row.PaymentReference).join(", ")} không ở trạng thái còn nợ`);
    }
    const total = rows.reduce((sum, row) => sum + Math.round(Number(row.AmountDue)), 0);
    if (!Number.isFinite(amount) || Math.round(amount) !== total) {
      throw badRequest("Số tiền không khớp với khoản phí cần nộp");
    }
    const reportedAt = new Date();
    for (const row of rows) {
      await row.update(
        { Status: "REPORTED", PaymentTransactionCode: transactionCode, PaymentProofUrl: proofUrl, ReportedAt: reportedAt },
        { transaction }
      );
    }
    return rows;
  });

  return res.status(200).json({
    success: true,
    message: "Gửi thành công, khoản phí chuyển sang \"Chờ xác nhận\"",
    data: items,
  });
};

// GET /admin/fee-payments — mặc định các khoản người bán đã báo nộp, chờ đối soát.
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
  const note = text(req.body.note, "ghi chú", { max: 500 });
  if (rule.noteRequired && !note) throw badRequest("Vui lòng nhập lý do");

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
      changes = { Status: Number(item.AdjustmentAmount) !== 0 ? "ADJUSTED" : "UNPAID", PaymentProofUrl: null, PaymentTransactionCode: null, ReportedAt: null };
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
  const resultMessages = {
    CONFIRM: "Khoản phí chuyển sang \"Đã thu\"",
    REJECT: "Khoản phí trở lại \"Còn nợ\"",
    WAIVE: "Khoản phí đã được miễn",
  };
  return res.status(200).json({ success: true, message: resultMessages[action], data: withOverdue(fresh) });
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
