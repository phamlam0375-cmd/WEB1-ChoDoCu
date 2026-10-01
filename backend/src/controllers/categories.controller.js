"use strict";

// B03 — Quản lý danh mục và lựa chọn tình trạng dùng chung cho đăng tin, tìm kiếm, bộ lọc.
const { Op } = require("sequelize");
const { sequelize, Categories } = require("../models");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, text, oneOf } = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");

const CATEGORY_STATUSES = ["ACTIVE", "INACTIVE"];

// Tình trạng sản phẩm dùng chung (khớp cột Listings.ConditionLevel).
const CONDITION_LEVELS = [
  { value: "LIKE_NEW", label: "Như mới", description: "Gần như chưa sử dụng, không trầy xước." },
  { value: "GOOD", label: "Tốt", description: "Có dấu hiệu sử dụng nhẹ, hoạt động bình thường." },
  { value: "FAIR", label: "Khá", description: "Trầy xước hoặc hao mòn thấy rõ, vẫn dùng được." },
  { value: "POOR", label: "Cũ nhiều", description: "Hư hỏng một phần, cần sửa chữa hoặc lấy linh kiện." },
];

const listingCountAttributes = [
  [sequelize.literal("(SELECT COUNT(*) FROM `Listings` l WHERE l.`CategoryId` = `Categories`.`CategoryId`)"), "ListingCount"],
  [
    sequelize.literal("(SELECT COUNT(*) FROM `Listings` l WHERE l.`CategoryId` = `Categories`.`CategoryId` AND l.`Status` IN ('ACTIVE','RESERVED'))"),
    "ActiveListingCount",
  ],
];

const findWithCounts = (id, transaction) =>
  Categories.findByPk(id, { attributes: { include: listingCountAttributes }, transaction });

const readCategoryInput = (body, { partial }) => {
  const data = {};
  if (!partial || body.CategoryName !== undefined) {
    data.CategoryName = text(body.CategoryName, "tên danh mục", { required: true, min: 2, max: 100 });
  }
  if (body.Description !== undefined) {
    data.Description = text(body.Description, "mô tả", { max: 300 });
  }
  if (!partial || body.Status !== undefined) {
    data.Status = body.Status === undefined ? "ACTIVE" : oneOf(body.Status, CATEGORY_STATUSES, "Trạng thái");
  }
  return data;
};

const ensureUniqueName = async (name, exceptId, transaction) => {
  // Collation utf8mb4_unicode_ci so sánh không phân biệt hoa thường.
  const duplicate = await Categories.findOne({
    where: { CategoryName: name, ...(exceptId ? { CategoryId: { [Op.ne]: exceptId } } : {}) },
    transaction,
  });
  if (duplicate) throw conflict(`Danh mục "${duplicate.CategoryName}" đã tồn tại`);
};

// GET /categories — danh mục đang hoạt động cho biểu mẫu và bộ lọc.
const listActiveCategories = async (_req, res) => {
  const categories = await Categories.findAll({
    where: { Status: "ACTIVE" },
    attributes: ["CategoryId", "CategoryName", "Description"],
    order: [["CategoryName", "ASC"]],
  });
  return res.status(200).json({ success: true, data: categories });
};

const listConditions = (_req, res) => res.status(200).json({ success: true, data: CONDITION_LEVELS });

const listCategories = async (req, res) => {
  const pagination = parsePagination(req.query, 50);
  const where = {};
  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) where.CategoryName = { [Op.like]: `%${q}%` };
  if (req.query.status) where.Status = oneOf(req.query.status, CATEGORY_STATUSES, "Trạng thái");

  const result = await Categories.findAndCountAll({
    where,
    attributes: { include: listingCountAttributes },
    order: [["CategoryName", "ASC"]],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return pagedResponse(res, result, pagination);
};

const createCategory = async (req, res) => {
  const data = readCategoryInput(req.body, { partial: false });

  const category = await sequelize.transaction(async (transaction) => {
    await ensureUniqueName(data.CategoryName, null, transaction);
    const created = await Categories.create(data, { transaction });
    await logAdminAction(
      req,
      {
        action: "CATEGORY_CREATE",
        targetType: "CATEGORY",
        targetId: created.CategoryId,
        newValue: { CategoryName: created.CategoryName, Description: created.Description, Status: created.Status },
      },
      { transaction }
    );
    return findWithCounts(created.CategoryId, transaction);
  });

  return res.status(201).json({ success: true, message: "Đã thêm danh mục", data: category });
};

const updateCategory = async (req, res) => {
  const id = parseId(req.params.id, "Mã danh mục");
  const data = readCategoryInput(req.body, { partial: true });
  if (!Object.keys(data).length) throw badRequest("Không có thay đổi nào");

  const category = await sequelize.transaction(async (transaction) => {
    const current = await Categories.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current) throw notFound("Không tìm thấy danh mục");

    const changedFields = Object.keys(data).filter((field) => (current[field] ?? null) !== (data[field] ?? null));
    if (!changedFields.length) throw badRequest("Không có thay đổi nào");
    if (changedFields.includes("CategoryName")) await ensureUniqueName(data.CategoryName, id, transaction);

    const oldValue = Object.fromEntries(changedFields.map((field) => [field, current[field]]));
    const newValue = Object.fromEntries(changedFields.map((field) => [field, data[field]]));
    await current.update(newValue, { transaction });

    await logAdminAction(
      req,
      { action: "CATEGORY_UPDATE", targetType: "CATEGORY", targetId: id, oldValue, newValue },
      { transaction }
    );
    return findWithCounts(id, transaction);
  });

  const warning = category.Status === "INACTIVE" && Number(category.get("ActiveListingCount")) > 0
    ? ` Danh mục đang có ${category.get("ActiveListingCount")} tin hoạt động; các tin này vẫn hiển thị nhưng không thể đăng tin mới vào danh mục.`
    : "";
  return res.status(200).json({ success: true, message: `Đã cập nhật danh mục.${warning}`, data: category });
};

module.exports = {
  CONDITION_LEVELS,
  listActiveCategories,
  listConditions,
  listCategories,
  createCategory,
  updateCategory,
};
