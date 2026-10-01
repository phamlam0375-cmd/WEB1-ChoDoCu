"use strict";

// B04 — Tiếp nhận báo cáo vi phạm; B05 — xử lý báo cáo (ẩn tin, khóa tài khoản).
const { Op, fn, col } = require("sequelize");
const { sequelize, Reports, Listings, Users, Orders } = require("../models");
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
const { logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { moderateListing, setUserStatus, isAdminUser } = require("../services/moderation.service");

const REPORT_REASONS = [
  "Sai mô tả",
  "Hàng giả, hàng nhái",
  "Sản phẩm cấm",
  "Nghi ngờ lừa đảo",
  "Spam hoặc tin trùng lặp",
  "Nội dung không phù hợp",
  "Khác",
];
const TARGET_TYPES = ["LISTING", "USER", "ORDER"];
const REPORT_STATUSES = ["PENDING", "PROCESSING", "RESOLVED", "REJECTED"];
const OPEN_STATUSES = ["PENDING", "PROCESSING"];

const TARGET_COLUMN = { LISTING: "ListingId", USER: "ReportedUserId", ORDER: "OrderId" };

const reportIncludes = [
  { model: Users, as: "Reporter", attributes: ["UserId", "FullName", "Email"] },
  { model: Users, as: "ReportedUser", attributes: ["UserId", "FullName", "Email", "Status"] },
  { model: Users, as: "Handler", attributes: ["UserId", "FullName"] },
  { model: Listings, as: "Listing", attributes: ["ListingId", "Title", "Status", "SellerId"] },
  { model: Orders, as: "Order", attributes: ["OrderId", "Status", "BuyerId", "SellerId"] },
];

const targetTypeOf = (report) => {
  if (report.OrderId) return "ORDER";
  if (report.ListingId) return "LISTING";
  return "USER";
};

const withTargetType = (report) => ({ ...report.get({ plain: true }), TargetType: targetTypeOf(report) });

const listReasons = (_req, res) => res.status(200).json({ success: true, data: REPORT_REASONS });

// POST /reports { targetType, targetId, reason, description, evidenceUrl }
const createReport = async (req, res) => {
  const reporterId = req.user.UserId;
  const targetType = oneOf(req.body.targetType, TARGET_TYPES, "Loại đối tượng bị báo cáo");
  const targetId = parseId(req.body.targetId, "Mã đối tượng bị báo cáo");
  const reason = oneOf(req.body.reason, REPORT_REASONS, "Lý do báo cáo");
  const description = text(req.body.description, "mô tả chi tiết", { required: reason === "Khác", min: 10, max: 1000 });
  const evidenceUrl = optionalUrl(req.body.evidenceUrl, "Đường dẫn bằng chứng");

  const data = { ReporterId: reporterId, Reason: reason, Description: description, EvidenceUrl: evidenceUrl };

  if (targetType === "LISTING") {
    const listing = await Listings.findByPk(targetId, { attributes: ["ListingId", "SellerId"] });
    if (!listing) throw notFound("Không tìm thấy tin đăng");
    if (listing.SellerId === reporterId) throw badRequest("Không thể báo cáo tin đăng của chính mình");
    Object.assign(data, { ListingId: listing.ListingId, ReportedUserId: listing.SellerId });
  } else if (targetType === "USER") {
    if (targetId === reporterId) throw badRequest("Không thể báo cáo chính mình");
    const user = await Users.findByPk(targetId, { attributes: ["UserId"] });
    if (!user) throw notFound("Không tìm thấy tài khoản");
    data.ReportedUserId = user.UserId;
  } else {
    const order = await Orders.findByPk(targetId, { attributes: ["OrderId", "BuyerId", "SellerId", "ListingId"] });
    if (!order) throw notFound("Không tìm thấy đơn hàng");
    if (![order.BuyerId, order.SellerId].includes(reporterId)) {
      throw forbidden("Chỉ người mua hoặc người bán của đơn mới được báo cáo đơn này");
    }
    Object.assign(data, {
      OrderId: order.OrderId,
      ListingId: order.ListingId,
      ReportedUserId: reporterId === order.BuyerId ? order.SellerId : order.BuyerId,
    });
  }

  const column = TARGET_COLUMN[targetType];
  const duplicate = await Reports.findOne({
    where: {
      ReporterId: reporterId,
      [column]: data[column],
      Status: OPEN_STATUSES,
      ...(targetType === "LISTING" ? { OrderId: null } : {}),
      ...(targetType === "USER" ? { ListingId: null, OrderId: null } : {}),
    },
  });
  if (duplicate) {
    throw conflict(`Bạn đã có báo cáo #${duplicate.ReportId} cho đối tượng này và đang chờ xử lý`);
  }

  const report = await Reports.create(data);
  return res.status(201).json({
    success: true,
    message: "Đã gửi báo cáo. Quản trị viên sẽ xem xét và phản hồi.",
    data: withTargetType(report),
  });
};

// GET /reports — người gửi theo dõi các báo cáo của mình.
const listMyReports = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = { ReporterId: req.user.UserId };
  if (req.query.status) where.Status = oneOf(req.query.status, REPORT_STATUSES, "Trạng thái");

  const result = await Reports.findAndCountAll({
    where,
    attributes: { exclude: ["HandledBy"] },
    include: [
      { model: Listings, as: "Listing", attributes: ["ListingId", "Title"] },
      { model: Users, as: "ReportedUser", attributes: ["UserId", "FullName"] },
    ],
    order: [["CreatedAt", "DESC"], ["ReportId", "DESC"]],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return pagedResponse(res, { rows: result.rows.map(withTargetType), count: result.count }, pagination);
};

const listReports = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = {};
  if (req.query.status) where.Status = oneOf(req.query.status, REPORT_STATUSES, "Trạng thái");
  if (req.query.reason) where.Reason = req.query.reason;
  if (req.query.targetType) {
    const type = oneOf(req.query.targetType, TARGET_TYPES, "Loại đối tượng");
    if (type === "ORDER") where.OrderId = { [Op.ne]: null };
    if (type === "LISTING") Object.assign(where, { ListingId: { [Op.ne]: null }, OrderId: null });
    if (type === "USER") Object.assign(where, { ListingId: null, OrderId: null });
  }
  const from = parseDate(req.query.from, "Từ ngày");
  const to = parseDate(req.query.to, "Đến ngày", { endOfDay: true });
  if (from || to) where.CreatedAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };

  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [
      { "$Listing.Title$": like },
      { "$ReportedUser.FullName$": like },
      { "$Reporter.FullName$": like },
      ...(/^\d+$/.test(q) ? [{ ReportId: Number(q) }, { ListingId: Number(q) }, { OrderId: Number(q) }] : []),
    ];
  }

  const [result, counts] = await Promise.all([
    Reports.findAndCountAll({
      where,
      include: reportIncludes,
      order: [["CreatedAt", "DESC"], ["ReportId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
    }),
    Reports.findAll({ attributes: ["Status", [fn("COUNT", col("ReportId")), "count"]], group: ["Status"], raw: true }),
  ]);

  return pagedResponse(res, { rows: result.rows.map(withTargetType), count: result.count }, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
  });
};

const getReport = async (req, res) => {
  const id = parseId(req.params.id, "Mã báo cáo");
  const report = await Reports.findByPk(id, { include: reportIncludes });
  if (!report) throw notFound("Không tìm thấy báo cáo");

  const [reportsAgainstUser, reportsAgainstListing] = await Promise.all([
    report.ReportedUserId ? Reports.count({ where: { ReportedUserId: report.ReportedUserId } }) : 0,
    report.ListingId ? Reports.count({ where: { ListingId: report.ListingId } }) : 0,
  ]);

  return res.status(200).json({
    success: true,
    data: { ...withTargetType(report), related: { reportsAgainstUser, reportsAgainstListing } },
  });
};

const DECISIONS = {
  PROCESSING: { from: ["PENDING"], audit: "REPORT_PROCESS", label: "đang được xử lý" },
  RESOLVED: { from: OPEN_STATUSES, audit: "REPORT_RESOLVE", label: "đã được xử lý" },
  REJECTED: { from: OPEN_STATUSES, audit: "REPORT_REJECT", label: "không đủ căn cứ vi phạm" },
};

// B05: PATCH /admin/reports/:id { status, resolution, hideListing, lockUser }
const handleReport = async (req, res) => {
  const id = parseId(req.params.id, "Mã báo cáo");
  const status = oneOf(req.body.status, Object.keys(DECISIONS), "Trạng thái xử lý");
  const resolution = text(req.body.resolution, "kết quả xử lý", { required: status !== "PROCESSING", min: 5, max: 1000 });
  const hideListing = req.body.hideListing === true;
  const lockUser = req.body.lockUser === true;
  if ((hideListing || lockUser) && status !== "RESOLVED") {
    throw badRequest("Chỉ ẩn tin hoặc khóa tài khoản khi kết luận có vi phạm (RESOLVED)");
  }

  const actions = [];
  const report = await sequelize.transaction(async (transaction) => {
    const item = await Reports.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy báo cáo");
    if (!DECISIONS[status].from.includes(item.Status)) {
      throw conflict(`Báo cáo đang ở trạng thái ${item.Status}, không thể chuyển sang ${status}`);
    }

    const source = `Báo cáo #${id}`;
    if (hideListing) {
      if (!item.ListingId) throw badRequest("Báo cáo này không gắn với tin đăng");
      const listing = await Listings.findByPk(item.ListingId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!listing) throw notFound("Tin đăng không còn tồn tại");
      if (listing.Status !== "HIDDEN") {
        await moderateListing(req, listing, "HIDE", resolution, { transaction, source });
        actions.push("Đã ẩn tin đăng");
      }
    }

    if (lockUser) {
      if (!item.ReportedUserId) throw badRequest("Báo cáo này không gắn với tài khoản");
      if (await isAdminUser(item.ReportedUserId, transaction)) {
        throw badRequest("Không thể khóa tài khoản quản trị viên qua báo cáo");
      }
      const user = await Users.findByPk(item.ReportedUserId, { transaction, lock: transaction.LOCK.UPDATE });
      if (await setUserStatus(req, user, "LOCKED", resolution, { transaction, source })) {
        actions.push("Đã khóa tài khoản bị báo cáo");
      }
    }

    const oldStatus = item.Status;
    await item.update(
      {
        Status: status,
        Resolution: resolution || item.Resolution,
        HandledBy: req.user.UserId,
        HandledAt: status === "PROCESSING" ? null : new Date(),
      },
      { transaction }
    );

    await logAdminAction(
      req,
      {
        action: DECISIONS[status].audit,
        targetType: "REPORT",
        targetId: id,
        oldValue: { Status: oldStatus },
        newValue: { Status: status, actions },
        note: resolution,
      },
      { transaction }
    );

    await notify(
      item.ReporterId,
      {
        type: "SYSTEM",
        title: `Báo cáo #${id} ${DECISIONS[status].label}`,
        message: resolution || "Quản trị viên đã tiếp nhận và đang xem xét báo cáo của bạn.",
        referenceType: "REPORT",
        referenceId: id,
      },
      { transaction }
    );
    return item;
  });

  const fresh = await Reports.findByPk(report.ReportId, { include: reportIncludes });
  return res.status(200).json({
    success: true,
    message: ["Đã lưu kết quả xử lý báo cáo", ...actions].join(". "),
    data: withTargetType(fresh),
  });
};

module.exports = {
  REPORT_REASONS,
  listReasons,
  createReport,
  listMyReports,
  listReports,
  getReport,
  handleReport,
};
