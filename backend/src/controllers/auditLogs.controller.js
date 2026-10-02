"use strict";

// B11 — Nhật ký thao tác quản trị. CHỈ ĐỌC: không có API sửa hoặc xóa.
const { Op } = require("sequelize");
const { AdminAuditLogs, Users, Roles } = require("../models");
const { badRequest } = require("../utils/httpError");
const { parsePagination, pagedResponse, optionalId, text, oneOf, parseDate } = require("../utils/request");
const { AUDIT_ACTIONS, TARGET_TYPES } = require("../services/auditLog.service");

const EXPORT_LIMIT = 5000;

const adminInclude = { model: Users, as: "Admin", attributes: ["UserId", "FullName", "Email"] };

const buildWhere = (query) => {
  const where = {};
  const adminId = optionalId(query.adminId, "Mã quản trị viên");
  if (adminId) where.AdminId = adminId;
  if (query.action) where.Action = oneOf(query.action, Object.keys(AUDIT_ACTIONS), "Hành động");
  if (query.targetType) where.TargetType = oneOf(query.targetType, Object.keys(TARGET_TYPES), "Loại đối tượng");
  const targetId = text(query.targetId, "mã đối tượng", { max: 64 });
  if (targetId) where.TargetId = targetId;

  const from = parseDate(query.from, "Từ ngày");
  const to = parseDate(query.to, "Đến ngày", { endOfDay: true });
  if (from && to && from > to) throw badRequest("Từ ngày phải trước hoặc bằng Đến ngày");
  if (from || to) where.CreatedAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };
  return where;
};

const parseJson = (value) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toDto = (log) => {
  const plain = log.get({ plain: true });
  return {
    ...plain,
    ActionLabel: AUDIT_ACTIONS[plain.Action] || plain.Action,
    TargetTypeLabel: TARGET_TYPES[plain.TargetType] || plain.TargetType,
    OldValue: parseJson(plain.OldValue),
    NewValue: parseJson(plain.NewValue),
  };
};

const listAuditLogs = async (req, res) => {
  const pagination = parsePagination(req.query, 25);
  const result = await AdminAuditLogs.findAndCountAll({
    where: buildWhere(req.query),
    include: [adminInclude],
    order: [["CreatedAt", "DESC"], ["LogId", "DESC"]],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return pagedResponse(res, { rows: result.rows.map(toDto), count: result.count }, pagination);
};

// Danh sách cho các ô lọc: hành động, loại đối tượng, quản trị viên.
const getAuditLogMeta = async (_req, res) => {
  const admins = await Users.findAll({
    attributes: ["UserId", "FullName", "Email"],
    include: [{ model: Roles, as: "Roles", where: { RoleName: "ADMIN" }, attributes: [], through: { attributes: [] } }],
    order: [["FullName", "ASC"]],
  });
  return res.status(200).json({
    success: true,
    data: {
      actions: Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label })),
      targetTypes: Object.entries(TARGET_TYPES).map(([value, label]) => ({ value, label })),
      admins,
      exportLimit: EXPORT_LIMIT,
    },
  });
};

// Ô bắt đầu bằng = + - @ bị Excel hiểu là công thức; thêm ' để vô hiệu hóa.
const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  let cell = typeof value === "string" ? value : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

// Chuỗi số như số tài khoản "0123..." hoặc dài hơn 11 chữ số: ép Excel giữ dạng văn bản,
// nếu không Excel sẽ bỏ số 0 đầu hoặc đổi sang dạng 1,23E+15.
const csvTextCell = (value) => {
  if (typeof value === "string" && /^\d+$/.test(value) && (value.startsWith("0") || value.length > 11)) {
    return `"=""${value}"""`;
  }
  return csvCell(value);
};

const formatLocalTime = (date) =>
  new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

// GET /admin/audit-logs/export — CSV UTF-8 có BOM để Excel đọc đúng tiếng Việt.
const exportAuditLogs = async (req, res) => {
  const where = buildWhere(req.query);
  const total = await AdminAuditLogs.count({ where });
  const logs = await AdminAuditLogs.findAll({
    where,
    include: [adminInclude],
    order: [["CreatedAt", "DESC"], ["LogId", "DESC"]],
    limit: EXPORT_LIMIT,
  });

  const header = ["Mã", "Thời gian (GMT+7)", "Quản trị viên", "Email", "Hành động", "Loại đối tượng", "Mã đối tượng", "Giá trị cũ", "Giá trị mới", "Ghi chú", "IP"];
  const lines = [header.map(csvCell).join(",")];
  for (const log of logs) {
    lines.push(
      [
        csvCell(log.LogId),
        csvCell(formatLocalTime(log.CreatedAt)),
        csvCell(log.Admin ? log.Admin.FullName : `#${log.AdminId ?? ""}`),
        csvCell(log.Admin ? log.Admin.Email : ""),
        csvCell(AUDIT_ACTIONS[log.Action] || log.Action),
        csvCell(TARGET_TYPES[log.TargetType] || log.TargetType),
        csvCell(log.TargetId),
        csvTextCell(log.OldValue),
        csvTextCell(log.NewValue),
        csvCell(log.Note),
        csvCell(log.IpAddress),
      ].join(",")
    );
  }

  const stamp = formatLocalTime(new Date()).replace(/[-: ]/g, "").slice(0, 12);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="nhat-ky-quan-tri-${stamp}.csv"`);
  res.setHeader("X-Total-Count", String(total));
  res.setHeader("X-Exported-Count", String(logs.length));
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Total-Count, X-Exported-Count");
  return res.status(200).send(`﻿${lines.join("\r\n")}\r\n`);
};

module.exports = { listAuditLogs, getAuditLogMeta, exportAuditLogs, EXPORT_LIMIT };
