"use strict";

const { Users, Roles } = require("../models");
const { HttpError, forbidden } = require("../utils/httpError");
const { verifyToken } = require("../middleware/authenticate");

const devHeaderEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_HEADER !== "false";

function resolveIdentity(req, allowDevHeader) {
  const authorization = req.get("authorization");
  // Không hạ cấp sang header dev nếu client đã gửi JWT sai/hết hạn.
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, "Phiên đăng nhập không hợp lệ.", null, "INVALID_TOKEN");
    return verifyToken(match[1]);
  }
  if (allowDevHeader && devHeaderEnabled()) {
    const userId = Number(req.get("x-user-id"));
    if (Number.isSafeInteger(userId) && userId > 0) return { userId };
  }
  throw new HttpError(401, "Vui lòng đăng nhập để tiếp tục.", null, "UNAUTHORIZED");
}

function authenticateUser({ allowDevHeader }) {
  return async (req, _res, next) => {
    try {
      const identity = resolveIdentity(req, allowDevHeader);
      const user = await Users.findByPk(identity.userId, {
        attributes: ["UserId", "FullName", "Email", "Phone", "Address", "Status"],
        include: [{ model: Roles, as: "Roles", attributes: ["RoleName"], through: { attributes: [] } }],
      });
      if (!user) throw new HttpError(401, "Tài khoản không tồn tại", null, "UNAUTHORIZED");
      if (user.Status === "LOCKED") throw forbidden("Tài khoản của bạn đang bị khóa");
      // Vai trò/trạng thái luôn lấy từ DB, không tin claim do client đưa vào.
      req.user = {
        ...identity,
        userId: user.UserId,
        UserId: user.UserId,
        FullName: user.FullName,
        Email: user.Email,
        Phone: user.Phone,
        Address: user.Address,
        Status: user.Status,
        roles: user.Roles.map((role) => role.RoleName),
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const requireAuth = authenticateUser({ allowDevHeader: true });
// /api/orders giữ yêu cầu JWT của Lam; /api/v1 hỗ trợ JWT và header dev có điều kiện.
const requireTokenAuth = authenticateUser({ allowDevHeader: false });

const requireRole = (...allowed) => (req, _res, next) => {
  if (!req.user || !allowed.some((role) => req.user.roles.includes(role))) {
    return next(forbidden("Bạn không có quyền truy cập chức năng này"));
  }
  return next();
};

const hasRole = (user, role) => Boolean(user && user.roles.includes(role));

module.exports = { requireAuth, requireTokenAuth, requireRole, hasRole };
