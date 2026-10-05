"use strict";

// Tiếp nhận báo cáo vi phạm và xử lý báo cáo (ẩn, gỡ tin, khóa tài khoản).
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
  if (!req.body.reason) throw badRequest("Vui lòng chọn lý do báo cáo");
  const reason = oneOf(req.body.reason, REPORT_REASONS, "Lý do báo cáo");
  const description = text(req.body.description, "mô tả chi tiết", { required: reason === "Khác", max: 1000 });
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
    const noun = { LISTING: "tin này", USER: "tài khoản này", ORDER: "đơn hàng này" }[targetType];
    throw conflict(`Bạn đã báo cáo ${noun}, vui lòng chờ kết quả xử lý`);
  }

  const report = await Reports.create(data);
  return res.status(201).json({
    success: true,
    message: "Gửi báo cáo thành công",
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
  REJECTED: { from: OPEN_STATUSES, audit: "REPORT_REJECT", label: "được kết luận không vi phạm" },
};

// Xử lý tin bị báo cáo khi kết luận có vi phạm: Ẩn tin (có thể khôi phục) hoặc Gỡ tin.
const LISTING_EFFECTS = { HIDE: "Đã ẩn tin đăng", REMOVE: "Đã gỡ tin đăng" };

// PATCH /admin/reports/:id { status, resolution, listingAction: HIDE|REMOVE, lockUser, expectedStatus }
//  - PROCESSING: "Chuyển xử lý" ở trang tiếp nhận báo cáo.
//  - RESOLVED:   Ẩn tin / Gỡ tin (bắt buộc lý do) ở trang kiểm duyệt.
//  - REJECTED:   Bác bỏ báo cáo, báo cáo chuyển sang "Không vi phạm".
const handleReport = async (req, res) => {
  const id = parseId(req.params.id, "Mã báo cáo");
  const status = oneOf(req.body.status, Object.keys(DECISIONS), "Trạng thái xử lý");
  const resolution = text(req.body.resolution, "lý do", { max: 1000 });
  const listingAction = req.body.listingAction ? oneOf(req.body.listingAction, Object.keys(LISTING_EFFECTS), "Cách xử lý tin") : null;
  // Tương thích phiên bản trước: hideListing = true tương đương listingAction HIDE.
  const effectiveListingAction = listingAction || (req.body.hideListing === true ? "HIDE" : null);
  const lockUser = req.body.lockUser === true;
  if ((effectiveListingAction || lockUser) && status !== "RESOLVED") {
    throw badRequest("Chỉ ẩn, gỡ tin hoặc khóa tài khoản khi kết luận có vi phạm");
  }
  if (status === "RESOLVED" && !resolution) throw badRequest("Vui lòng nhập lý do");

  const actions = [];
  const report = await sequelize.transaction(async (transaction) => {
    const item = await Reports.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw notFound("Không tìm thấy báo cáo");
    const expectedStatus = req.body.expectedStatus;
    if (!DECISIONS[status].from.includes(item.Status) || (expectedStatus && expectedStatus !== item.Status)) {
      throw conflict("Báo cáo đã được xử lý, vui lòng tải lại trang");
    }

    const source = `Báo cáo #${id}`;
    if (effectiveListingAction) {
      if (!item.ListingId) throw badRequest("Báo cáo này không gắn với tin đăng");
      const listing = await Listings.findByPk(item.ListingId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!listing) throw notFound("Tin đăng không còn tồn tại");
      const alreadyDone = effectiveListingAction === "HIDE" ? ["HIDDEN", "REMOVED"] : ["REMOVED"];
      if (!alreadyDone.includes(listing.Status)) {
        await moderateListing(req, listing, effectiveListingAction, resolution, { transaction, source });
        actions.push(LISTING_EFFECTS[effectiveListingAction]);
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

    const finalResolution = status === "REJECTED" && !resolution ? "Không phát hiện vi phạm." : resolution;
    const oldStatus = item.Status;
    await item.update(
      {
        Status: status,
        Resolution: finalResolution || item.Resolution,
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
        note: finalResolution,
      },
      { transaction }
    );

    // Người báo cáo luôn nhận kết quả; người đăng tin nhận thông báo qua moderateListing.
    await notify(
      item.ReporterId,
      {
        type: "SYSTEM",
        title: `Báo cáo #${id} ${DECISIONS[status].label}`,
        message: [finalResolution || "Quản trị viên đã tiếp nhận và đang xem xét báo cáo của bạn.", ...actions].join(". "),
        referenceType: "REPORT",
        referenceId: id,
      },
      { transaction }
    );
    return item;
  });

  const resultMessages = {
    PROCESSING: "Báo cáo đã chuyển sang \"Đang xử lý\"",
    RESOLVED: "Xử lý thành công",
    REJECTED: "Báo cáo đã chuyển sang \"Không vi phạm\"",
  };
  const fresh = await Reports.findByPk(report.ReportId, { include: reportIncludes });
  return res.status(200).json({
    success: true,
    message: [resultMessages[status], ...actions].join(". "),
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
