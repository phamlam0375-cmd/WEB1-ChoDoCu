"use strict";

const { Users, Roles } = require("../models");
const { HttpError, forbidden } = require("../utils/httpError");

// TẠM THỜI cho tới khi A02 (đăng nhập) hoàn thành: nhận mã người dùng qua header
// x-user-id. Chỉ bật ngoài production. Khi có JWT, chỉ cần thay hàm resolveUserId
// để đọc Authorization: Bearer <token>; phần còn lại giữ nguyên.
const devHeaderEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_HEADER !== "false";

const resolveUserId = (req) => {
  if (devHeaderEnabled()) {
    const id = Number(req.get("x-user-id"));
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
};

// Gắn req.user = { UserId, FullName, Email, Status, roles: ["USER", "ADMIN", ...] }.
const requireAuth = async (req, _res, next) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return next(new HttpError(401, "Vui lòng đăng nhập"));
  }

  const user = await Users.findByPk(userId, {
    attributes: ["UserId", "FullName", "Email", "Status"],
    include: [{ model: Roles, as: "Roles", attributes: ["RoleName"], through: { attributes: [] } }],
  });

  if (!user) {
    return next(new HttpError(401, "Tài khoản không tồn tại"));
  }
  if (user.Status === "LOCKED") {
    return next(forbidden("Tài khoản của bạn đang bị khóa"));
  }

  req.user = {
    UserId: user.UserId,
    FullName: user.FullName,
    Email: user.Email,
    Status: user.Status,
    roles: user.Roles.map((role) => role.RoleName),
  };
  return next();
};

const requireRole = (...allowed) => (req, _res, next) => {
  if (!req.user || !allowed.some((role) => req.user.roles.includes(role))) {
    return next(forbidden("Bạn không có quyền truy cập chức năng này"));
  }
  return next();
};

const hasRole = (user, role) => Boolean(user && user.roles.includes(role));

module.exports = { requireAuth, requireRole, hasRole };
