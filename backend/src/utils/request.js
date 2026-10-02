"use strict";

const { badRequest } = require("./httpError");

const MAX_PAGE_SIZE = 100;

// Đọc ?page=&limit= và trả về offset cho findAndCountAll.
const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

const pagedResponse = (res, { rows, count }, { page, limit }, extra = {}) =>
  res.status(200).json({
    success: true,
    data: rows,
    pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    ...extra,
  });

const parseId = (value, label = "Mã") => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`${label} không hợp lệ`);
  }
  return id;
};

const optionalId = (value, label) =>
  value === undefined || value === null || value === "" ? null : parseId(value, label);

// Chuỗi bắt buộc hoặc tùy chọn, đã trim và kiểm tra độ dài.
const text = (value, label, { required = false, min = 0, max = 255 } = {}) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw badRequest(`Vui lòng nhập ${label}`);
    return null;
  }
  if (trimmed.length < min) throw badRequest(`${label} phải có ít nhất ${min} ký tự`);
  if (trimmed.length > max) throw badRequest(`${label} tối đa ${max} ký tự`);
  return trimmed;
};

const oneOf = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw badRequest(`${label} không hợp lệ. Giá trị cho phép: ${allowed.join(", ")}`);
  }
  return value;
};

// Sequelize lưu giờ UTC; ngày người dùng chọn được hiểu theo giờ Việt Nam.
const APP_UTC_OFFSET = "+07:00";

// Ngày dạng YYYY-MM-DD; endOfDay = true để lọc "đến hết ngày".
const parseDate = (value, label, { endOfDay = false } = {}) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${label} phải có dạng YYYY-MM-DD`);
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${APP_UTC_OFFSET}`);
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} không hợp lệ`);
  return date;
};

const optionalUrl = (value, label) => {
  const url = text(value, label, { max: 255 });
  if (url && !/^(https?:\/\/|\/)[^\s]+$/i.test(url)) {
    throw badRequest(`${label} phải là đường dẫn http(s) hoặc đường dẫn nội bộ bắt đầu bằng /`);
  }
  return url;
};

const clientIp = (req) => (req.ip || req.socket?.remoteAddress || "").slice(0, 45) || null;

module.exports = {
  APP_UTC_OFFSET,
  parsePagination,
  pagedResponse,
  parseId,
  optionalId,
  text,
  oneOf,
  parseDate,
  optionalUrl,
  clientIp,
};
