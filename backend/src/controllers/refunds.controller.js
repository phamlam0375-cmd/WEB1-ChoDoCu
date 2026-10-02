"use strict";

// Tiếp nhận yêu cầu hoàn tiền: người mua gửi, theo dõi tiến độ; quản trị tiếp nhận để xem xét.
// Website không giữ tiền: người bán chuyển trả trực tiếp cho người mua (có mã QR VietQR),
// website ghi nhận từng bước và điều chỉnh hoa hồng khi hoàn tiền xong.
//
// Trạng thái: PENDING (Chờ xử lý) → REVIEWING (Đang xem xét) → APPROVED (Chờ người bán chuyển trả)
//   → SELLER_TRANSFERRED (Chờ người mua xác nhận) → COMPLETED (Hoàn tất)
//   Nhánh khác: REJECTED (Từ chối), DISPUTED (Đang tranh chấp — người mua báo chưa nhận được tiền).
const { Op, fn, col } = require("sequelize");
const {
  sequelize,
  RefundRequests,
  Orders,
  Payments,
  Users,
  Roles,
  Listings,
  StatusHistories,
} = require("../models");
const { badRequest, notFound, conflict, forbidden } = require("../utils/httpError");
const {
  parsePagination,
  pagedResponse,
  parseId,
  text,
  oneOf,
  optionalUrl,
  parseDate,
} = require("../utils/request");
const { BANK_BY_CODE } = require("../utils/banks");
const { hasRole } = require("../middlewares/auth.middleware");
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { getSettingAt } = require("../services/settings.service");

const DAY_MS = 24 * 60 * 60 * 1000;
const REFUND_STATUSES = ["PENDING", "REVIEWING", "APPROVED", "REJECTED", "SELLER_TRANSFERRED", "DISPUTED", "COMPLETED"];
const OPEN_STATUSES = ["PENDING", "REVIEWING", "APPROVED", "SELLER_TRANSFERRED", "DISPUTED"];
// Đơn ở các trạng thái này chắc chắn người mua đã trả tiền sản phẩm.
const PAID_ORDER_STATUSES = ["PAID", "IN_DELIVERY", "DELIVERED", "COMPLETED"];
const CLOSED_ORDER_STATUSES = ["CANCELLED", "REFUNDED", "REFUND_PENDING"];

const REFUND_REASONS = [
  "Sản phẩm không đúng mô tả",
  "Sản phẩm bị lỗi, hư hỏng",
  "Giao sai sản phẩm",
  "Không nhận được hàng",
  "Người bán không giao hàng",
  "Khác",
];

const STATUS_LABELS = {
  PENDING: "Chờ xử lý",
  REVIEWING: "Đang xem xét",
  APPROVED: "Chờ người bán chuyển trả",
  REJECTED: "Từ chối",
  SELLER_TRANSFERRED: "Chờ người mua xác nhận",
  DISPUTED: "Đang tranh chấp",
  COMPLETED: "Hoàn tất",
};

const orderInclude = {
  model: Orders,
  as: "Order",
  attributes: ["OrderId", "BuyerId", "SellerId", "ProductAmount", "DeliveryFee", "TotalAmount", "Status", "CreatedAt", "CompletedAt"],
  include: [
    { model: Users, as: "Seller", attributes: ["UserId", "FullName", "Email", "Phone"] },
    { model: Listings, as: "Listing", attributes: ["ListingId", "Title"] },
  ],
};
const refundIncludes = [
  orderInclude,
  { model: Users, as: "Requester", attributes: ["UserId", "FullName", "Email", "Phone"] },
  { model: Users, as: "Reviewer", attributes: ["UserId", "FullName"] },
];

const formatVnd = (value) => `${Math.round(Number(value)).toLocaleString("vi-VN")}đ`;

// Mã yêu cầu hoàn tiền, dùng làm nội dung chuyển khoản khi người bán trả tiền.
const refundCode = (id) => `HT${String(id).padStart(6, "0")}`;

const addHistory = (orderId, statusType, statusValue, note, changedBy, transaction) =>
  StatusHistories.create(
    { OrderId: orderId, StatusType: statusType, StatusValue: statusValue, Note: note ? note.slice(0, 500) : null, ChangedBy: changedBy },
    { transaction }
  );

const notifyAdmins = async (payload, transaction) => {
  const admins = await Users.findAll({
    attributes: ["UserId"],
    where: { Status: "ACTIVE" },
    include: [{ model: Roles, as: "Roles", where: { RoleName: "ADMIN" }, attributes: [], through: { attributes: [] } }],
    transaction,
  });
  for (const admin of admins) await notify(admin.UserId, payload, { transaction });
};

const parseAmount = (value, max) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw badRequest("Số tiền hoàn phải là số nguyên lớn hơn 0");
  }
  if (amount > max) throw badRequest("Số tiền hoàn không được vượt quá giá trị đơn hàng");
  return amount;
};

const readRefundAccount = (body) => {
  const bankCode = String(body.refundBankCode || "").trim();
  if (!BANK_BY_CODE[bankCode]) throw badRequest("Vui lòng chọn ngân hàng nhận tiền hoàn");
  const accountNumber = String(body.refundAccountNumber || "").trim();
  if (!/^\d{6,20}$/.test(accountNumber)) throw badRequest("Số tài khoản ngân hàng phải gồm 6–20 chữ số");
  const accountHolder = String(body.refundAccountHolder || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!accountHolder) throw badRequest("Vui lòng nhập tên chủ tài khoản");
  if (accountHolder.length > 100) throw badRequest("Tên chủ tài khoản tối đa 100 ký tự");
  return { RefundBankCode: bankCode, RefundAccountNumber: accountNumber, RefundAccountHolder: accountHolder };
};

const listReasons = (_req, res) => res.status(200).json({ success: true, data: REFUND_REASONS });

// POST /orders/:id/refund-requests
// { reason, description?, amount?, evidenceUrl?, refundBankCode, refundAccountNumber, refundAccountHolder }
const createRefundRequest = async (req, res) => {
  const orderId = parseId(req.params.id, "Mã đơn hàng");
  if (!req.body.reason) throw badRequest("Vui lòng chọn lý do hoàn tiền");
  const reason = oneOf(req.body.reason, REFUND_REASONS, "Lý do hoàn tiền");
  const description = text(req.body.description, "mô tả", { required: reason === "Khác", max: 1000 });
  const evidenceUrl = optionalUrl(req.body.evidenceUrl, "Ảnh bằng chứng");
  const account = readRefundAccount(req.body);

  const refund = await sequelize.transaction(async (transaction) => {
    const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw notFound("Không tìm thấy đơn hàng");
    if (order.BuyerId !== req.user.UserId) throw forbidden("Chỉ người mua của đơn mới được yêu cầu hoàn tiền");

    const open = await RefundRequests.findOne({ where: { OrderId: orderId, Status: OPEN_STATUSES }, transaction });
    if (open) throw conflict("Đơn hàng này đã có yêu cầu hoàn tiền đang xử lý");
    if (CLOSED_ORDER_STATUSES.includes(order.Status)) {
      throw badRequest("Đơn hàng không ở trạng thái có thể yêu cầu hoàn tiền");
    }

    const payment = await Payments.findOne({ where: { OrderId: orderId }, attributes: ["Status"], transaction });
    const paid = PAID_ORDER_STATUSES.includes(order.Status) || (payment && payment.Status === "CONFIRMED");
    if (!paid) throw badRequest("Chỉ yêu cầu hoàn tiền cho đơn hàng đã thanh toán");

    if (order.CompletedAt) {
      // Hạn hoàn tiền theo cấu hình có hiệu lực lúc đặt đơn.
      const windowDays = await getSettingAt("REFUND_WINDOW_DAYS", order.CreatedAt, { transaction });
      const deadline = new Date(order.CompletedAt).getTime() + windowDays * DAY_MS;
      if (Date.now() > deadline) throw badRequest("Đơn hàng đã quá thời hạn yêu cầu hoàn tiền");
    }

    const productAmount = Number(order.ProductAmount);
    const amount = req.body.amount === undefined || req.body.amount === "" ? productAmount : parseAmount(req.body.amount, productAmount);

    const created = await RefundRequests.create(
      {
        OrderId: orderId,
        RequestedBy: req.user.UserId,
        Reason: reason,
        Description: description,
        EvidenceUrl: evidenceUrl,
        Amount: amount,
        Status: "PENDING",
        OrderStatusBefore: order.Status,
        ...account,
      },
      { transaction }
    );

    await order.update({ Status: "REFUND_PENDING" }, { transaction });
    await addHistory(orderId, "REFUND", "PENDING", reason, req.user.UserId, transaction);
    await addHistory(orderId, "ORDER", "REFUND_PENDING", `Yêu cầu hoàn tiền ${refundCode(created.RefundRequestId)}`, req.user.UserId, transaction);

    const payload = {
      type: "REFUND",
      title: `Đơn #${orderId} có yêu cầu hoàn tiền`,
      message: `Người mua yêu cầu hoàn ${formatVnd(amount)}. Lý do: ${reason}.`,
      referenceType: "REFUND_REQUEST",
      referenceId: created.RefundRequestId,
    };
    await notify(order.SellerId, payload, { transaction });
    await notifyAdmins(payload, transaction);
    return created;
  });

  return res.status(201).json({ success: true, message: "Gửi yêu cầu thành công", data: refund });
};

// GET /refund-requests?as=buyer|seller — người mua/người bán theo dõi tiến độ.
const listMyRefundRequests = async (req, res) => {
  const pagination = parsePagination(req.query);
  const as = req.query.as === "seller" ? "seller" : "buyer";
  const where = as === "buyer" ? { RequestedBy: req.user.UserId } : { "$Order.SellerId$": req.user.UserId };
  if (req.query.status) where.Status = oneOf(req.query.status, REFUND_STATUSES, "Trạng thái");

  const result = await RefundRequests.findAndCountAll({
    where,
    attributes: { exclude: ["ReviewedBy", "OrderStatusBefore"] },
    include: [orderInclude, { model: Users, as: "Requester", attributes: ["UserId", "FullName"] }],
    order: [["RequestedAt", "DESC"], ["RefundRequestId", "DESC"]],
    limit: pagination.limit,
    offset: pagination.offset,
    subQuery: false,
  });
  return pagedResponse(res, result, pagination);
};

const getRefundRequest = async (req, res) => {
  const id = parseId(req.params.id, "Mã yêu cầu hoàn tiền");
  const refund = await RefundRequests.findByPk(id, { include: refundIncludes });
  if (!refund) throw notFound("Không tìm thấy yêu cầu hoàn tiền");
  const isSeller = refund.Order.SellerId === req.user.UserId;
  const isBuyer = refund.Order.BuyerId === req.user.UserId;
  if (!isSeller && !isBuyer && !hasRole(req.user, "ADMIN")) throw forbidden();

  const history = await StatusHistories.findAll({
    where: { OrderId: refund.OrderId, StatusType: { [Op.in]: ["REFUND", "ORDER"] }, CreatedAt: { [Op.gte]: refund.RequestedAt } },
    order: [["CreatedAt", "ASC"], ["HistoryId", "ASC"]],
  });

  const code = refundCode(id);
  const bank = BANK_BY_CODE[refund.RefundBankCode];
  return res.status(200).json({
    success: true,
    data: {
      ...refund.get({ plain: true }),
      RefundCode: code,
      StatusLabel: STATUS_LABELS[refund.Status],
      RefundBankName: bank ? bank.shortName : null,
      history,
    },
  });
};

const listRefundRequests = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = {};
  if (req.query.status) where.Status = oneOf(req.query.status, REFUND_STATUSES, "Trạng thái");
  const from = parseDate(req.query.from, "Từ ngày");
  const to = parseDate(req.query.to, "Đến ngày", { endOfDay: true });
  if (from || to) where.RequestedAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };

  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [
      { "$Requester.FullName$": like },
      { "$Order.Seller.FullName$": like },
      { "$Order.Listing.Title$": like },
      ...(/^\d+$/.test(q) ? [{ RefundRequestId: Number(q) }, { OrderId: Number(q) }] : []),
    ];
  }

  const [result, counts] = await Promise.all([
    RefundRequests.findAndCountAll({
      where,
      include: refundIncludes,
      order: [["RequestedAt", "DESC"], ["RefundRequestId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
    }),
    RefundRequests.findAll({ attributes: ["Status", [fn("COUNT", col("RefundRequestId")), "count"]], group: ["Status"], raw: true }),
  ]);

  return pagedResponse(res, result, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
  });
};

// Ai được làm gì, từ trạng thái nào sang trạng thái nào.
const ACTIONS = {
  REVIEW: { actor: "ADMIN", from: ["PENDING"], to: "REVIEWING", audit: "REFUND_REVIEW" },
};

const canAct = (req, actor, order) => {
  if (actor === "ADMIN") return hasRole(req.user, "ADMIN");
  if (actor === "SELLER") return order.SellerId === req.user.UserId;
  return order.BuyerId === req.user.UserId;
};

const RESULT_MESSAGES = {
  REVIEW: "Yêu cầu đã chuyển sang \"Đang xem xét\"",
};

// PATCH /refund-requests/:id { action: REVIEW, note?, expectedStatus? }
const updateRefundRequest = async (req, res) => {
  const id = parseId(req.params.id, "Mã yêu cầu hoàn tiền");
  const action = oneOf(req.body.action, Object.keys(ACTIONS), "Hành động");
  const rule = ACTIONS[action];
  const note = text(req.body.note, "ghi chú", { max: 1000 });
  const warnings = [];

  const refund = await sequelize.transaction(async (transaction) => {
    const item = await RefundRequests.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy yêu cầu hoàn tiền");
    const order = await Orders.findByPk(item.OrderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!canAct(req, rule.actor, order)) throw forbidden();
    const expectedStatus = req.body.expectedStatus;
    if (!rule.from.includes(item.Status) || (expectedStatus && expectedStatus !== item.Status)) {
      throw conflict("Yêu cầu đã được xử lý, vui lòng tải lại trang");
    }

    const oldStatus = item.Status;
    const oldAmount = Number(item.Amount);
    const now = new Date();
    const changes = rule.to ? { Status: rule.to } : {};
    const code = refundCode(id);
    const label = `yêu cầu hoàn tiền ${code} (đơn #${order.OrderId})`;
    const send = (userId, title, message) =>
      notify(userId, { type: "REFUND", title, message, referenceType: "REFUND_REQUEST", referenceId: id }, { transaction });

    if (action === "REVIEW") {
      Object.assign(changes, { ReviewedBy: req.user.UserId, ReviewedAt: now });
      await send(order.BuyerId, "Yêu cầu hoàn tiền đang được xem xét", `Quản trị viên đã tiếp nhận ${label}.`);
    }

    await item.update(changes, { transaction });
    if (rule.to) await addHistory(order.OrderId, "REFUND", rule.to, note || null, req.user.UserId, transaction);

    if (rule.audit) {
      await logAdminAction(
        req,
        {
          action: rule.audit,
          targetType: "REFUND_REQUEST",
          targetId: id,
          oldValue: { Status: oldStatus, Amount: oldAmount },
          newValue: { Status: rule.to, Amount: Number(item.Amount), OrderId: order.OrderId },
          note: [note, ...warnings].filter(Boolean).join(" | "),
        },
        { transaction }
      );
    }
    return item;
  });

  const fresh = await RefundRequests.findByPk(refund.RefundRequestId, { include: refundIncludes });
  return res.status(200).json({
    success: true,
    message: [RESULT_MESSAGES[action], ...warnings].join(". "),
    warnings,
    data: fresh,
  });
};

module.exports = {
  REFUND_REASONS,
  listReasons,
  createRefundRequest,
  listMyRefundRequests,
  getRefundRequest,
  listRefundRequests,
  updateRefundRequest,
};
