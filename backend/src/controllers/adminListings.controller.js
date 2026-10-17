"use strict";

// Kiểm duyệt tin đăng: duyệt, từ chối, ẩn, gỡ và khôi phục.
const { Op, fn, col } = require("sequelize");
const { Anthropic } = require("@anthropic-ai/sdk");
const { sequelize, Listings, ListingMedia, Users, Categories, Reports, ListingAiReviews, ConditionOptions } = require("../models");
const { HttpError, badRequest, notFound } = require("../utils/httpError");
const aiReview = require("../services/listingAiReview.service");
const { parsePagination, pagedResponse, parseId, optionalId, text, oneOf } = require("../utils/request");
const { LISTING_ACTIONS, moderateListing } = require("../services/moderation.service");

const REVIEW_MESSAGES = {
  APPROVE: "Duyệt thành công",
  REJECT: "Tin đã chuyển sang \"Bị từ chối\"",
  HIDE: "Đã ẩn tin đăng",
  REMOVE: "Đã gỡ tin đăng",
  RESTORE: "Đã khôi phục tin đăng",
};

const LISTING_STATUSES = ["DRAFT", "PENDING", "ACTIVE", "RESERVED", "SOLD", "HIDDEN", "SUSPENDED", "REMOVED", "REJECTED"];

const openReportCount = [
  sequelize.literal(
    "(SELECT COUNT(*) FROM `Reports` r WHERE r.`ListingId` = `Listings`.`ListingId` AND r.`Status` IN ('PENDING','PROCESSING'))"
  ),
  "OpenReportCount",
];

const baseIncludes = [
  { model: Users, as: "Seller", attributes: ["UserId", "FullName", "Email", "Status"] },
  { model: Categories, as: "Category", attributes: ["CategoryId", "CategoryName"] },
  { model: ListingAiReviews, as: "AiReview", required: false },
];

// Kết quả AI lưu Reasons/Flags dạng chuỗi JSON; trả về mảng cho giao diện.
const parseList = (value) => {
  try {
    const list = JSON.parse(value || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const formatAiReview = (row) =>
  row
    ? {
        recommendation: row.Recommendation,
        riskLevel: row.RiskLevel,
        summary: row.Summary,
        reasons: parseList(row.Reasons),
        flags: parseList(row.Flags),
        model: row.Model,
        reviewedAt: row.ReviewedAt,
      }
    : null;
const withAiReview = (listing) => {
  const plain = listing.get ? listing.get({ plain: true }) : listing;
  const { AiReview, ...rest } = plain;
  return { ...rest, aiReview: formatAiReview(AiReview) };
};

const listListings = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = {};
  if (req.query.status) where.Status = oneOf(req.query.status, LISTING_STATUSES, "Trạng thái");
  const categoryId = optionalId(req.query.categoryId, "Mã danh mục");
  if (categoryId) where.CategoryId = categoryId;
  if (req.query.reported === "true") {
    where.ListingId = {
      [Op.in]: sequelize.literal("(SELECT r.`ListingId` FROM `Reports` r WHERE r.`ListingId` IS NOT NULL AND r.`Status` IN ('PENDING','PROCESSING'))"),
    };
  }

  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [
      { Title: like },
      { "$Seller.FullName$": like },
      ...(/^\d+$/.test(q) ? [{ ListingId: Number(q) }] : []),
    ];
  }

  const [result, counts] = await Promise.all([
    Listings.findAndCountAll({
      where,
      attributes: { exclude: ["Description", "KnownDefects"], include: [openReportCount] },
      include: baseIncludes,
      // Tin chờ duyệt: cũ trước (xử lý theo thứ tự gửi); còn lại mới trước.
      order: [["CreatedAt", where.Status === "PENDING" ? "ASC" : "DESC"], ["ListingId", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
    }),
    Listings.findAll({ attributes: ["Status", [fn("COUNT", col("ListingId")), "count"]], group: ["Status"], raw: true }),
  ]);

  return pagedResponse(res, { rows: result.rows.map(withAiReview), count: result.count }, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
    ai: { configured: aiReview.isConfigured() },
  });
};

const getListing = async (req, res) => {
  const id = parseId(req.params.id, "Mã tin đăng");
  const listing = await Listings.findByPk(id, {
    include: [
      ...baseIncludes,
      { model: ListingMedia, as: "Media", attributes: ["MediaId", "MediaType", "MediaUrl", "SortOrder"] },
    ],
    order: [[{ model: ListingMedia, as: "Media" }, "SortOrder", "ASC"]],
  });
  if (!listing) throw notFound("Không tìm thấy tin đăng");

  const reports = await Reports.findAll({
    where: { ListingId: id },
    attributes: ["ReportId", "Reason", "Description", "Status", "CreatedAt"],
    include: [{ model: Users, as: "Reporter", attributes: ["UserId", "FullName"] }],
    order: [["CreatedAt", "DESC"]],
    limit: 20,
  });

  return res.status(200).json({ success: true, data: { ...withAiReview(listing), reports, aiConfigured: aiReview.isConfigured() } });
};

// Lỗi khi gọi AI: báo lý do dễ hiểu, không làm hỏng trang kiểm duyệt.
const aiError = (error) => {
  if (error instanceof Anthropic.AuthenticationError) return new HttpError(502, "API key của dịch vụ AI không hợp lệ");
  if (error instanceof Anthropic.RateLimitError) return new HttpError(503, "Dịch vụ AI đang quá tải, vui lòng thử lại sau ít phút");
  if (error instanceof Anthropic.APIError) return new HttpError(502, "Dịch vụ AI tạm thời không phản hồi, vui lòng thử lại");
  return new HttpError(502, "Không phân tích được tin bằng AI, vui lòng thử lại");
};

const ensureAiConfigured = () => {
  if (!aiReview.isConfigured()) {
    throw new HttpError(503, "Chưa cấu hình AI: thêm ANTHROPIC_API_KEY vào backend/.env rồi khởi động lại API");
  }
};

// Phân tích một tin bằng AI và lưu kết quả (ghi đè lần phân tích trước).
const analyzeAndSave = async (listingId) => {
  const listing = await Listings.findByPk(listingId, {
    attributes: { include: [openReportCount] },
    include: [{ model: Categories, as: "Category", attributes: ["CategoryName"] }],
  });
  if (!listing) throw notFound("Không tìm thấy tin đăng");
  const condition = await ConditionOptions.findByPk(listing.ConditionLevel, { attributes: ["Label"] });
  const input = { ...listing.get({ plain: true }), ConditionLabel: condition?.Label };

  let result;
  try {
    result = await aiReview.reviewListing(input);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[AI kiểm duyệt]", error.message);
    throw aiError(error);
  }
  const row = {
    ListingId: listingId,
    Recommendation: result.recommendation,
    RiskLevel: result.riskLevel,
    Summary: result.summary,
    Reasons: JSON.stringify(result.reasons),
    Flags: JSON.stringify(result.flags),
    Model: result.model,
    ReviewedAt: new Date(),
  };
  await ListingAiReviews.upsert(row);
  return formatAiReview(row);
};

// POST /admin/listings/:id/ai-review — phân tích (hoặc phân tích lại) một tin.
const runAiReview = async (req, res) => {
  ensureAiConfigured();
  const id = parseId(req.params.id, "Mã tin đăng");
  const data = await analyzeAndSave(id);
  return res.status(200).json({ success: true, message: "AI đã phân tích tin đăng", data });
};

// POST /admin/listings/ai-review-pending — phân tích các tin chờ duyệt chưa có kết quả AI (tối đa 5 tin mỗi lần).
const AI_BATCH_SIZE = 5;
const reviewPendingWithAi = async (req, res) => {
  ensureAiConfigured();
  const pending = await Listings.findAll({
    where: { Status: "PENDING", "$AiReview.ListingId$": null },
    include: [{ model: ListingAiReviews, as: "AiReview", required: false, attributes: [] }],
    attributes: ["ListingId"],
    order: [["CreatedAt", "ASC"]],
    limit: AI_BATCH_SIZE,
    subQuery: false,
  });
  let reviewed = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await analyzeAndSave(item.ListingId);
      reviewed += 1;
    } catch {
      failed += 1;
    }
  }
  return res.status(200).json({ success: true, data: { reviewed, failed } });
};

// PATCH /admin/listings/:id/review { action: APPROVE | REJECT | HIDE | RESTORE, note }
const reviewListing = async (req, res) => {
  const id = parseId(req.params.id, "Mã tin đăng");
  const action = oneOf(req.body.action, Object.keys(LISTING_ACTIONS), "Hành động");
  const note = text(req.body.note, "lý do", { max: 500 });

  const result = await sequelize.transaction(async (transaction) => {
    const listing = await Listings.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!listing) throw notFound("Không tìm thấy tin đăng");
    return moderateListing(req, listing, action, note, { transaction, expectedStatus: req.body.expectedStatus });
  });

  return res.status(200).json({
    success: true,
    message: REVIEW_MESSAGES[action],
    data: { ListingId: id, ...result },
  });
};

// POST /admin/listings/bulk-review { ids: [], action: APPROVE | REJECT, note } — duyệt/từ chối nhiều tin chờ duyệt.
// Mỗi tin xử lý riêng: tin đã được người khác xử lý thì bỏ qua và báo lại, các tin khác vẫn được lưu.
const BULK_ACTIONS = ["APPROVE", "REJECT"];
const BULK_LIMIT = 50;
const bulkReviewListings = async (req, res) => {
  const action = oneOf(req.body.action, BULK_ACTIONS, "Hành động");
  const note = text(req.body.note, "lý do", { max: 500 });
  if (action === "REJECT" && !note) throw badRequest("Vui lòng nhập lý do từ chối");
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((value) => parseId(value, "Mã tin đăng")))] : [];
  if (!ids.length) throw badRequest("Vui lòng chọn ít nhất một tin đăng");
  if (ids.length > BULK_LIMIT) throw badRequest(`Mỗi lần xử lý tối đa ${BULK_LIMIT} tin`);

  const done = [];
  const failed = [];
  for (const id of ids) {
    try {
      await sequelize.transaction(async (transaction) => {
        const listing = await Listings.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!listing) throw notFound("Không tìm thấy tin đăng");
        await moderateListing(req, listing, action, note, { transaction, expectedStatus: "PENDING" });
      });
      done.push(id);
    } catch (error) {
      failed.push({ id, message: error instanceof HttpError ? error.message : "Không xử lý được tin này" });
    }
  }

  const verb = action === "APPROVE" ? "Đã duyệt" : "Đã từ chối";
  return res.status(200).json({
    success: true,
    message: failed.length ? `${verb} ${done.length} tin, ${failed.length} tin không xử lý được` : `${verb} ${done.length} tin`,
    data: { done, failed },
  });
};

module.exports = { listListings, getListing, reviewListing, runAiReview, reviewPendingWithAi, bulkReviewListings };
