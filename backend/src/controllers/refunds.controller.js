"use strict";

// B06 — Tiếp nhận yêu cầu hoàn tiền; B07 — Giải quyết hoàn tiền.
// Website không giữ tiền: người bán chuyển trả trực tiếp cho người mua, website ghi nhận
// từng bước và điều chỉnh hoa hồng khi hoàn tiền xong.
const { Op, fn, col } = require("sequelize");
const {
  sequelize,
  RefundRequests,
  Orders,
  Payments,
  Users,
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
const { hasRole } = require("../middlewares/auth.middleware");
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { getSettingAt } = require("../services/settings.service");
const { adjustCommissionForRefund } = require("../services/commission.service");

const DAY_MS = 24 * 60 * 60 * 1000;
const REFUND_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SELLER_TRANSFERRED", "COMPLETED"];
const OPEN_STATUSES = ["PENDING", "APPROVED", "SELLER_TRANSFERRED"];
// Đơn ở các trạng thái này chắc chắn người mua đã trả tiền sản phẩm.
const PAID_ORDER_STATUSES = ["PAID", "IN_DELIVERY", "DELIVERED", "COMPLETED"];
const CLOSED_ORDER_STATUSES = ["CANCELLED", "REFUNDED", "REFUND_PENDING"];

const orderInclude = {
  model: Orders,
  as: "Order",
  attributes: ["OrderId", "BuyerId", "SellerId", "ProductAmount", "DeliveryFee", "Status", "CreatedAt", "CompletedAt"],
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

const addHistory = (orderId, statusType, statusValue, note, changedBy, transaction) =>
  StatusHistories.create(
    { OrderId: orderId, StatusType: statusType, StatusValue: statusValue, Note: note ? note.slice(0, 500) : null, ChangedBy: changedBy },
    { transaction }
  );

const parseAmount = (value, max) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw badRequest("Số tiền hoàn phải là số nguyên dương (đồng)");
  }
  if (amount > max) {
    throw badRequest(`Số tiền hoàn không được vượt quá tiền sản phẩm (${formatVnd(max)}). Phí giao hàng trả riêng cho tài xế.`);
  }
  return amount;
};

// POST /orders/:id/refund-requests { reason, amount?, evidenceUrl? }
const createRefundRequest = async (req, res) => {
  const orderId = parseId(req.params.id, "Mã đơn hàng");
  const reason = text(req.body.reason, "lý do hoàn tiền", { required: true, min: 10, max: 500 });
  const evidenceUrl = optionalUrl(req.body.evidenceUrl, "Đường dẫn bằng chứng");

  const refund = await sequelize.transaction(async (transaction) => {
    const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw notFound("Không tìm thấy đơn hàng");
    if (order.BuyerId !== req.user.UserId) throw forbidden("Chỉ người mua của đơn mới được yêu cầu hoàn tiền");

    const open = await RefundRequests.findOne({ where: { OrderId: orderId, Status: OPEN_STATUSES }, transaction });
    if (open) throw conflict(`Đơn đang có yêu cầu hoàn tiền #${open.RefundRequestId} chưa xử lý xong`);
    if (CLOSED_ORDER_STATUSES.includes(order.Status)) {
      throw badRequest(`Đơn đang ở trạng thái ${order.Status}, không thể yêu cầu hoàn tiền`);
    }

    const payment = await Payments.findOne({ where: { OrderId: orderId }, attributes: ["Status"], transaction });
    const paid = PAID_ORDER_STATUSES.includes(order.Status) || (payment && payment.Status === "CONFIRMED");
    if (!paid) throw badRequest("Người bán chưa xác nhận nhận tiền cho đơn này nên chưa cần hoàn tiền; bạn có thể hủy đơn");

    if (order.CompletedAt) {
      // Hạn hoàn tiền theo cấu hình có hiệu lực lúc đặt đơn (B12).
      const windowDays = await getSettingAt("REFUND_WINDOW_DAYS", order.CreatedAt, { transaction });
      const deadline = new Date(new Date(order.CompletedAt).getTime() + windowDays * DAY_MS);
      if (Date.now() > deadline.getTime()) {
        throw badRequest(`Đã quá hạn yêu cầu hoàn tiền (${windowDays} ngày kể từ khi đơn hoàn tất)`);
      }
    }

    const productAmount = Number(order.ProductAmount);
    const amount = req.body.amount === undefined || req.body.amount === "" ? productAmount : parseAmount(req.body.amount, productAmount);

    const created = await RefundRequests.create(
      {
        OrderId: orderId,
        RequestedBy: req.user.UserId,
        Reason: reason,
        EvidenceUrl: evidenceUrl,
        Amount: amount,
        Status: "PENDING",
        OrderStatusBefore: order.Status,
      },
      { transaction }
    );

    await order.update({ Status: "REFUND_PENDING" }, { transaction });
    await addHistory(orderId, "REFUND", "PENDING", reason, req.user.UserId, transaction);
    await addHistory(orderId, "ORDER", "REFUND_PENDING", `Yêu cầu hoàn tiền #${created.RefundRequestId}`, req.user.UserId, transaction);
    await notify(
      order.SellerId,
      {
        type: "REFUND",
        title: `Đơn #${orderId} có yêu cầu hoàn tiền`,
        message: `Người mua yêu cầu hoàn ${formatVnd(amount)}. Quản trị viên sẽ xem xét trước khi bạn cần chuyển trả.`,
        referenceType: "REFUND_REQUEST",
        referenceId: created.RefundRequestId,
      },
      { transaction }
    );
    return created;
  });

  return res.status(201).json({ success: true, message: "Đã gửi yêu cầu hoàn tiền", data: refund });
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

const findRefundForViewer = async (req, id, transaction) => {
  const refund = await RefundRequests.findByPk(id, { include: refundIncludes, transaction });
  if (!refund) throw notFound("Không tìm thấy yêu cầu hoàn tiền");
  const isParty = [refund.Order.BuyerId, refund.Order.SellerId].includes(req.user.UserId);
  if (!isParty && !hasRole(req.user, "ADMIN")) throw forbidden();
  return refund;
};

const getRefundRequest = async (req, res) => {
  const id = parseId(req.params.id, "Mã yêu cầu hoàn tiền");
  const refund = await findRefundForViewer(req, id);
  const history = await StatusHistories.findAll({
    where: { OrderId: refund.OrderId, StatusType: { [Op.in]: ["REFUND", "ORDER"] }, CreatedAt: { [Op.gte]: refund.RequestedAt } },
    order: [["CreatedAt", "ASC"], ["HistoryId", "ASC"]],
  });
  return res.status(200).json({ success: true, data: { ...refund.get({ plain: true }), history } });
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
  APPROVE: { actor: "ADMIN", from: ["PENDING"], to: "APPROVED" },
  REJECT: { actor: "ADMIN", from: ["PENDING"], to: "REJECTED" },
  SELLER_TRANSFERRED: { actor: "SELLER", from: ["APPROVED"], to: "SELLER_TRANSFERRED" },
  CONFIRM_RECEIVED: { actor: "BUYER", from: ["SELLER_TRANSFERRED"], to: "COMPLETED" },
  NOT_RECEIVED: { actor: "BUYER", from: ["SELLER_TRANSFERRED"], to: "APPROVED" },
  ADMIN_COMPLETE: { actor: "ADMIN", from: ["SELLER_TRANSFERRED"], to: "COMPLETED" },
};

const canAct = (req, actor, order) => {
  if (actor === "ADMIN") return hasRole(req.user, "ADMIN");
  if (actor === "SELLER") return order.SellerId === req.user.UserId;
  return order.BuyerId === req.user.UserId;
};

// PATCH /refund-requests/:id { action, note?, amount?, refundProofUrl? }
const updateRefundRequest = async (req, res) => {
  const id = parseId(req.params.id, "Mã yêu cầu hoàn tiền");
  const action = oneOf(req.body.action, Object.keys(ACTIONS), "Hành động");
  const rule = ACTIONS[action];
  const noteRequired = ["REJECT", "NOT_RECEIVED", "ADMIN_COMPLETE"].includes(action);
  const note = text(req.body.note, "ghi chú", { required: noteRequired, min: 5, max: 500 });
  const warnings = [];

  const refund = await sequelize.transaction(async (transaction) => {
    const item = await RefundRequests.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy yêu cầu hoàn tiền");
    const order = await Orders.findByPk(item.OrderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!canAct(req, rule.actor, order)) throw forbidden();
    if (!rule.from.includes(item.Status)) {
      throw conflict(`Yêu cầu đang ở trạng thái ${item.Status}, không thể thực hiện thao tác này`);
    }

    const oldStatus = item.Status;
    const oldAmount = Number(item.Amount);
    const now = new Date();
    const changes = { Status: rule.to };
    const refLabel = `yêu cầu hoàn tiền #${id} (đơn #${order.OrderId})`;
    const notifyBoth = (title, message) =>
      Promise.all(
        [order.BuyerId, order.SellerId].map((userId) =>
          notify(userId, { type: "REFUND", title, message, referenceType: "REFUND_REQUEST", referenceId: id }, { transaction })
        )
      );

    if (action === "APPROVE") {
      if (req.body.amount !== undefined && req.body.amount !== "") {
        changes.Amount = parseAmount(req.body.amount, Math.min(Number(order.ProductAmount), Number(item.Amount)));
      }
      Object.assign(changes, { AdminNote: note, ReviewedBy: req.user.UserId, ReviewedAt: now });
    }

    if (action === "REJECT") {
      Object.assign(changes, { AdminNote: note, ReviewedBy: req.user.UserId, ReviewedAt: now });
      const restored = item.OrderStatusBefore || "COMPLETED";
      await order.update({ Status: restored }, { transaction });
      await addHistory(order.OrderId, "ORDER", restored, `Từ chối ${refLabel}`, req.user.UserId, transaction);
    }

    if (action === "SELLER_TRANSFERRED") {
      const proof = optionalUrl(req.body.refundProofUrl, "Ảnh chứng minh đã chuyển trả");
      if (!proof) throw badRequest("Vui lòng cung cấp ảnh chứng minh đã chuyển trả tiền");
      changes.RefundProofUrl = proof;
    }

    if (action === "CONFIRM_RECEIVED" || action === "ADMIN_COMPLETE") {
      changes.CompletedAt = now;
      await order.update({ Status: "REFUNDED" }, { transaction });
      await addHistory(order.OrderId, "ORDER", "REFUNDED", `Hoàn tất ${refLabel}`, req.user.UserId, transaction);

      const adjustment = await adjustCommissionForRefund(order, item.Amount, { transaction });
      if (adjustment.note) warnings.push(adjustment.note);
      if (adjustment.changed) {
        warnings.push(
          `Hoa hồng đơn #${order.OrderId}: ${formatVnd(adjustment.before.AmountDue)} → ${formatVnd(adjustment.commission.AmountDue)}`
        );
      }
    }

    await item.update(changes, { transaction });
    await addHistory(order.OrderId, "REFUND", rule.to, note || action, req.user.UserId, transaction);

    if (rule.actor === "ADMIN") {
      await logAdminAction(
        req,
        {
          action: { APPROVE: "REFUND_APPROVE", REJECT: "REFUND_REJECT", ADMIN_COMPLETE: "REFUND_COMPLETE" }[action],
          targetType: "REFUND_REQUEST",
          targetId: id,
          oldValue: { Status: oldStatus, Amount: oldAmount },
          newValue: { Status: rule.to, Amount: Number(item.Amount), OrderId: order.OrderId },
          note: [note, ...warnings].filter(Boolean).join(" | "),
        },
        { transaction }
      );
    }

    const amountText = formatVnd(item.Amount);
    const messages = {
      APPROVE: [`Đã duyệt ${refLabel}`, `Người bán cần chuyển trả ${amountText} cho người mua.${note ? ` Ghi chú: ${note}` : ""}`],
      REJECT: [`Từ chối ${refLabel}`, `Lý do: ${note}`],
      SELLER_TRANSFERRED: [`Người bán đã chuyển trả tiền`, `Người bán báo đã chuyển ${amountText} cho ${refLabel}. Người mua vui lòng kiểm tra và xác nhận.`],
      CONFIRM_RECEIVED: [`Hoàn tiền hoàn tất`, `Người mua xác nhận đã nhận ${amountText} cho ${refLabel}.`],
      NOT_RECEIVED: [`Người mua chưa nhận được tiền hoàn`, `${refLabel}: ${note}`],
      ADMIN_COMPLETE: [`Hoàn tiền hoàn tất`, `Quản trị viên xác nhận đã hoàn ${amountText} cho ${refLabel}. ${note}`],
    };
    await notifyBoth(...messages[action]);
    return item;
  });

  const fresh = await RefundRequests.findByPk(refund.RefundRequestId, { include: refundIncludes });
  return res.status(200).json({
    success: true,
    message: ["Đã cập nhật yêu cầu hoàn tiền", ...warnings].join(". "),
    warnings,
    data: fresh,
  });
};

module.exports = {
  createRefundRequest,
  listMyRefundRequests,
  getRefundRequest,
  listRefundRequests,
  updateRefundRequest,
};
