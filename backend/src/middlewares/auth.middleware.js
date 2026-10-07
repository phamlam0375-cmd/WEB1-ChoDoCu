"use strict";

const { Users, Roles } = require("../models");
const { HttpError, forbidden } = require("../utils/httpError");
const { verifyToken } = require("../middleware/authenticate");

// Nhận người dùng theo hai cách:
// 1. Header x-user-id (tài khoản thử nghiệm, chỉ bật ngoài production) — ưu tiên vì là lựa chọn chủ động.
// 2. Authorization: Bearer <JWT> — cùng token với phần đặt hàng (ký bằng JWT_SECRET).
const devHeaderEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_HEADER !== "false";

const resolveUserId = (req) => {
  if (devHeaderEnabled()) {
    const id = Number(req.get("x-user-id"));
    if (Number.isInteger(id) && id > 0) return id;
  }
  const match = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (match && process.env.JWT_SECRET) {
    try {
      return verifyToken(match[1]).userId;
    } catch (error) {
      throw new HttpError(401, error.code === "TOKEN_EXPIRED" ? "Phiên đăng nhập đã hết hạn" : "Phiên đăng nhập không hợp lệ");
    }
  }
  return null;
};

// Gắn req.user = { UserId, FullName, Email, Status, roles: ["USER", "ADMIN", ...] }.
const requireAuth = async (req, _res, next) => {
  let userId;
  try {
    userId = resolveUserId(req);
  } catch (error) {
    return next(error);
  }
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
