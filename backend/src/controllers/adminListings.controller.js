"use strict";

// B05 — Kiểm duyệt tin đăng: duyệt, từ chối, gỡ (ẩn) và khôi phục.
const { Op, fn, col } = require("sequelize");
const { sequelize, Listings, ListingMedia, Users, Categories, Reports } = require("../models");
const { notFound } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, optionalId, text, oneOf } = require("../utils/request");
const { LISTING_ACTIONS, moderateListing } = require("../services/moderation.service");

const LISTING_STATUSES = ["DRAFT", "PENDING", "ACTIVE", "RESERVED", "SOLD", "HIDDEN", "REJECTED"];

const openReportCount = [
  sequelize.literal(
    "(SELECT COUNT(*) FROM `Reports` r WHERE r.`ListingId` = `Listings`.`ListingId` AND r.`Status` IN ('PENDING','PROCESSING'))"
  ),
  "OpenReportCount",
];

const baseIncludes = [
  { model: Users, as: "Seller", attributes: ["UserId", "FullName", "Email", "Status"] },
  { model: Categories, as: "Category", attributes: ["CategoryId", "CategoryName"] },
];

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

  return pagedResponse(res, result, pagination, {
    counts: Object.fromEntries(counts.map((row) => [row.Status, Number(row.count)])),
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

  return res.status(200).json({ success: true, data: { ...listing.get({ plain: true }), reports } });
};

// PATCH /admin/listings/:id/review { action: APPROVE | REJECT | HIDE | RESTORE, note }
const reviewListing = async (req, res) => {
  const id = parseId(req.params.id, "Mã tin đăng");
  const action = oneOf(req.body.action, Object.keys(LISTING_ACTIONS), "Hành động");
  const note = text(req.body.note, "lý do", { max: 500 });

  const result = await sequelize.transaction(async (transaction) => {
    const listing = await Listings.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!listing) throw notFound("Không tìm thấy tin đăng");
    return moderateListing(req, listing, action, note, { transaction });
  });

  return res.status(200).json({
    success: true,
    message: `Đã cập nhật tin đăng: ${result.oldStatus} → ${result.newStatus}`,
    data: { ListingId: id, ...result },
  });
};

module.exports = { listListings, getListing, reviewListing };
