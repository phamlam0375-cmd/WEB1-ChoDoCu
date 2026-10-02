"use strict";

// Quản lý danh mục và lựa chọn tình trạng dùng chung cho đăng tin, tìm kiếm và bộ lọc.
const { Op } = require("sequelize");
const { sequelize, Categories, ConditionOptions, Listings } = require("../models");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, text, oneOf } = require("../utils/request");
const { logAdminAction } = require("../services/auditLog.service");

const STATUSES = ["ACTIVE", "INACTIVE"];

// Bỏ khoảng trắng thừa ở đầu, cuối và giữa các từ.
const normalizeName = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

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
    const name = normalizeName(body.CategoryName);
    if (!name) throw badRequest("Vui lòng nhập tên danh mục");
    if (name.length > 100) throw badRequest("Tên danh mục tối đa 100 ký tự");
    data.CategoryName = name;
  }
  if (body.Description !== undefined) {
    data.Description = text(body.Description, "mô tả", { max: 300 });
  }
  if (!partial || body.Status !== undefined) {
    data.Status = body.Status === undefined ? "ACTIVE" : oneOf(body.Status, STATUSES, "Trạng thái");
  }
  return data;
};

// Cột CategoryName dùng collation utf8mb4_0900_as_ci: không phân biệt hoa thường,
// nhưng phân biệt dấu ("Bàn" và "Bán" là hai danh mục khác nhau).
const ensureUniqueName = async (name, exceptId, transaction) => {
  const duplicate = await Categories.findOne({
    where: { CategoryName: name, ...(exceptId ? { CategoryId: { [Op.ne]: exceptId } } : {}) },
    transaction,
  });
  if (duplicate) throw conflict("Tên danh mục đã tồn tại");
};

// GET /categories — danh mục đang hiện, dùng cho biểu mẫu đăng tin và bộ lọc.
const listActiveCategories = async (_req, res) => {
  const categories = await Categories.findAll({
    where: { Status: "ACTIVE" },
    attributes: ["CategoryId", "CategoryName", "Description"],
    order: [["CategoryName", "ASC"]],
  });
  return res.status(200).json({ success: true, data: categories });
};

const listCategories = async (req, res) => {
  const pagination = parsePagination(req.query, 50);
  const where = {};
  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) where.CategoryName = { [Op.like]: `%${q}%` };
  if (req.query.status) where.Status = oneOf(req.query.status, STATUSES, "Trạng thái");

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

  return res.status(201).json({ success: true, message: "Thêm danh mục thành công", data: category });
};

// PATCH /admin/categories/:id — sửa tên/mô tả, hoặc vô hiệu hóa / hiện lại (Status).
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

  const onlyStatus = Object.keys(data).length === 1 && data.Status;
  const message = onlyStatus
    ? data.Status === "INACTIVE" ? "Danh mục đã chuyển sang \"Ẩn\"" : "Danh mục đã chuyển sang \"Hiện\""
    : "Cập nhật danh mục thành công";
  return res.status(200).json({ success: true, message, data: category });
};

// DELETE /admin/categories/:id — chỉ xóa được danh mục chưa có tin đăng nào.
const deleteCategory = async (req, res) => {
  const id = parseId(req.params.id, "Mã danh mục");

  await sequelize.transaction(async (transaction) => {
    const category = await Categories.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!category) throw notFound("Không tìm thấy danh mục");
    const used = await Listings.count({ where: { CategoryId: id }, transaction });
    if (used > 0) throw conflict("Không thể xóa danh mục đang được sử dụng, chỉ có thể vô hiệu hóa");

    await category.destroy({ transaction });
    await logAdminAction(
      req,
      {
        action: "CATEGORY_DELETE",
        targetType: "CATEGORY",
        targetId: id,
        oldValue: { CategoryName: category.CategoryName, Description: category.Description, Status: category.Status },
      },
      { transaction }
    );
  });

  return res.status(200).json({ success: true, message: "Xóa danh mục thành công" });
};

// ---- Lựa chọn tình trạng sản phẩm ----

// Mã tình trạng sinh từ nhãn: "Đã qua sử dụng" -> "DA_QUA_SU_DUNG".
const codeFromLabel = (label) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

const conditionUsage = [
  sequelize.literal("(SELECT COUNT(*) FROM `Listings` l WHERE l.`ConditionLevel` = `ConditionOptions`.`ConditionCode`)"),
  "ListingCount",
];

// GET /categories/conditions — lựa chọn đang hiện (form đăng tin, tìm kiếm, bộ lọc).
const listConditions = async (_req, res) => {
  const items = await ConditionOptions.findAll({
    where: { Status: "ACTIVE" },
    order: [["SortOrder", "ASC"], ["Label", "ASC"]],
  });
  return res.status(200).json({
    success: true,
    data: items.map((item) => ({ value: item.ConditionCode, label: item.Label, description: item.Description })),
  });
};

// GET /admin/conditions — mọi lựa chọn kèm số tin đang dùng.
const listAllConditions = async (_req, res) => {
  const items = await ConditionOptions.findAll({
    attributes: { include: [conditionUsage] },
    order: [["SortOrder", "ASC"], ["Label", "ASC"]],
  });
  return res.status(200).json({ success: true, data: items });
};

const readConditionInput = (body, { partial }) => {
  const data = {};
  if (!partial || body.Label !== undefined) {
    const label = normalizeName(body.Label);
    if (!label) throw badRequest("Vui lòng nhập tên tình trạng");
    if (label.length > 60) throw badRequest("Tên tình trạng tối đa 60 ký tự");
    data.Label = label;
  }
  if (body.Description !== undefined) data.Description = text(body.Description, "mô tả", { max: 200 });
  if (body.Status !== undefined) data.Status = oneOf(body.Status, STATUSES, "Trạng thái");
  if (body.SortOrder !== undefined) {
    const order = Number(body.SortOrder);
    if (!Number.isInteger(order) || order < 0 || order > 999) throw badRequest("Thứ tự hiển thị phải là số nguyên từ 0 đến 999");
    data.SortOrder = order;
  }
  return data;
};

const ensureUniqueCondition = async (label, exceptCode, transaction) => {
  const duplicate = await ConditionOptions.findOne({
    where: { Label: label, ...(exceptCode ? { ConditionCode: { [Op.ne]: exceptCode } } : {}) },
    transaction,
  });
  if (duplicate) throw conflict("Tên tình trạng đã tồn tại");
};

const createCondition = async (req, res) => {
  const data = readConditionInput(req.body, { partial: false });
  const condition = await sequelize.transaction(async (transaction) => {
    await ensureUniqueCondition(data.Label, null, transaction);
    let code = codeFromLabel(data.Label) || "TINH_TRANG";
    // Tránh trùng mã khi hai nhãn khác dấu cho ra cùng một mã.
    for (let suffix = 2; await ConditionOptions.findByPk(code, { transaction }); suffix += 1) {
      code = `${codeFromLabel(data.Label).slice(0, 26)}_${suffix}`;
    }
    const maxOrder = (await ConditionOptions.max("SortOrder", { transaction })) || 0;
    const created = await ConditionOptions.create(
      { ConditionCode: code, Status: "ACTIVE", SortOrder: maxOrder + 1, ...data },
      { transaction }
    );
    await logAdminAction(
      req,
      { action: "CONDITION_CREATE", targetType: "CONDITION", targetId: code, newValue: data },
      { transaction }
    );
    return created;
  });
  return res.status(201).json({ success: true, message: "Lựa chọn tình trạng đã được cập nhật", data: condition });
};

const updateCondition = async (req, res) => {
  const code = text(req.params.code, "mã tình trạng", { required: true, max: 30 });
  const data = readConditionInput(req.body, { partial: true });
  if (!Object.keys(data).length) throw badRequest("Không có thay đổi nào");

  const condition = await sequelize.transaction(async (transaction) => {
    const current = await ConditionOptions.findByPk(code, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current) throw notFound("Không tìm thấy lựa chọn tình trạng");
    const changed = Object.keys(data).filter((field) => (current[field] ?? null) !== (data[field] ?? null));
    if (!changed.length) throw badRequest("Không có thay đổi nào");
    if (changed.includes("Label")) await ensureUniqueCondition(data.Label, code, transaction);

    const oldValue = Object.fromEntries(changed.map((field) => [field, current[field]]));
    const newValue = Object.fromEntries(changed.map((field) => [field, data[field]]));
    await current.update(newValue, { transaction });
    await logAdminAction(
      req,
      { action: "CONDITION_UPDATE", targetType: "CONDITION", targetId: code, oldValue, newValue },
      { transaction }
    );
    return current;
  });
  return res.status(200).json({ success: true, message: "Lựa chọn tình trạng đã được cập nhật", data: condition });
};

module.exports = {
  listActiveCategories,
  listConditions,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listAllConditions,
  createCondition,
  updateCondition,
};
