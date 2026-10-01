"use strict";

// B01 — Quản lý tài khoản và phân quyền.
const { Op } = require("sequelize");
const {
  sequelize,
  Users,
  Roles,
  UserRoles,
  Listings,
  Orders,
  Reports,
  AdminAuditLogs,
} = require("../models");
const { badRequest, notFound } = require("../utils/httpError");
const { parsePagination, pagedResponse, parseId, text, oneOf } = require("../utils/request");
const { AUDIT_ACTIONS, logAdminAction } = require("../services/auditLog.service");
const { notify } = require("../services/notification.service");
const { setUserStatus } = require("../services/moderation.service");
const { getSellerDebt } = require("../services/commission.service");

const ROLE_NAMES = ["USER", "ADMIN", "SELLER", "DRIVER"];
const USER_STATUSES = ["ACTIVE", "LOCKED"];

const roleInclude = { model: Roles, as: "Roles", attributes: ["RoleId", "RoleName"], through: { attributes: [] } };

const toUserDto = (user) => {
  const plain = user.get({ plain: true });
  return { ...plain, Roles: (plain.Roles || []).map((role) => role.RoleName) };
};

const listUsers = async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = {};

  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [{ FullName: like }, { Email: like }, { Phone: like }, { Username: like }];
    if (/^\d+$/.test(q)) where[Op.or].push({ UserId: Number(q) });
  }
  if (req.query.status) where.Status = oneOf(req.query.status, USER_STATUSES, "Trạng thái");
  if (req.query.role) {
    const role = oneOf(req.query.role, ROLE_NAMES, "Vai trò");
    where.UserId = {
      [Op.in]: sequelize.literal(
        `(SELECT ur.UserId FROM UserRoles ur JOIN Roles r ON r.RoleId = ur.RoleId WHERE r.RoleName = ${sequelize.escape(role)})`
      ),
    };
  }

  const result = await Users.findAndCountAll({
    where,
    include: [roleInclude],
    distinct: true,
    order: [["UserId", "DESC"]],
    limit: pagination.limit,
    offset: pagination.offset,
  });

  return pagedResponse(res, { rows: result.rows.map(toUserDto), count: result.count }, pagination);
};

const getUser = async (req, res) => {
  const id = parseId(req.params.id, "Mã tài khoản");
  const user = await Users.findByPk(id, { include: [roleInclude] });
  if (!user) throw notFound("Không tìm thấy tài khoản");

  const [listingCount, buyerOrderCount, sellerOrderCount, reportCount, debt, history] = await Promise.all([
    Listings.count({ where: { SellerId: id } }),
    Orders.count({ where: { BuyerId: id } }),
    Orders.count({ where: { SellerId: id } }),
    Reports.count({ where: { ReportedUserId: id } }),
    getSellerDebt(id),
    AdminAuditLogs.findAll({
      where: { TargetType: "USER", TargetId: String(id) },
      include: [{ model: Users, as: "Admin", attributes: ["UserId", "FullName"] }],
      order: [["CreatedAt", "DESC"], ["LogId", "DESC"]],
      limit: 10,
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...toUserDto(user),
      stats: { listingCount, buyerOrderCount, sellerOrderCount, reportCount, debt },
      history: history.map((log) => ({ ...log.get({ plain: true }), ActionLabel: AUDIT_ACTIONS[log.Action] || log.Action })),
    },
  });
};

// PATCH { status?, roles?, reason }: đổi trạng thái và/hoặc thay toàn bộ danh sách vai trò.
const updateUser = async (req, res) => {
  const id = parseId(req.params.id, "Mã tài khoản");
  const reason = text(req.body.reason, "lý do", { required: true, min: 5, max: 500 });
  const status = req.body.status === undefined ? null : oneOf(req.body.status, USER_STATUSES, "Trạng thái");

  let desiredRoles = null;
  if (req.body.roles !== undefined) {
    if (!Array.isArray(req.body.roles)) throw badRequest("Danh sách vai trò không hợp lệ");
    desiredRoles = [...new Set(["USER", ...req.body.roles.map((role) => oneOf(role, ROLE_NAMES, "Vai trò"))])];
  }
  if (!status && !desiredRoles) throw badRequest("Không có thay đổi nào");

  const result = await sequelize.transaction(async (transaction) => {
    const user = await Users.findByPk(id, { include: [roleInclude], transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw notFound("Không tìm thấy tài khoản");

    let changed = false;
    if (status) {
      changed = (await setUserStatus(req, user, status, reason, { transaction })) || changed;
    }

    if (desiredRoles) {
      // Chỉ quản lý 4 vai trò chuẩn; vai trò khác (nếu có) được giữ nguyên.
      const currentRoles = user.Roles.map((role) => role.RoleName).filter((role) => ROLE_NAMES.includes(role));
      if (id === req.user.UserId && currentRoles.includes("ADMIN") && !desiredRoles.includes("ADMIN")) {
        throw badRequest("Không thể tự thu hồi quyền quản trị của chính mình");
      }

      const toGrant = desiredRoles.filter((role) => !currentRoles.includes(role));
      const toRevoke = currentRoles.filter((role) => !desiredRoles.includes(role));

      if (toGrant.length || toRevoke.length) {
        const roles = await Roles.findAll({ where: { RoleName: [...toGrant, ...toRevoke] }, transaction });
        const idOf = Object.fromEntries(roles.map((role) => [role.RoleName, role.RoleId]));
        const missing = [...toGrant, ...toRevoke].filter((role) => !idOf[role]);
        if (missing.length) throw badRequest(`Vai trò chưa được khởi tạo trong hệ thống: ${missing.join(", ")}`);

        if (toRevoke.length) {
          await UserRoles.destroy({ where: { UserId: id, RoleId: toRevoke.map((role) => idOf[role]) }, transaction });
        }
        for (const role of toGrant) {
          await UserRoles.create({ UserId: id, RoleId: idOf[role] }, { transaction });
        }

        await logAdminAction(
          req,
          {
            action: "USER_ROLES_UPDATE",
            targetType: "USER",
            targetId: id,
            oldValue: { Roles: currentRoles },
            newValue: { Roles: desiredRoles },
            note: reason,
          },
          { transaction }
        );
        await notify(
          id,
          {
            type: "SYSTEM",
            title: "Vai trò tài khoản đã thay đổi",
            message: [
              toGrant.length ? `Được cấp: ${toGrant.join(", ")}` : null,
              toRevoke.length ? `Bị thu hồi: ${toRevoke.join(", ")}` : null,
              `Lý do: ${reason}`,
            ].filter(Boolean).join(". "),
            referenceType: "USER",
            referenceId: id,
          },
          { transaction }
        );
        changed = true;
      }
    }

    if (!changed) throw badRequest("Không có thay đổi nào");
    return Users.findByPk(id, { include: [roleInclude], transaction });
  });

  return res.status(200).json({ success: true, message: "Cập nhật tài khoản thành công", data: toUserDto(result) });
};

module.exports = { listUsers, getUser, updateUser, ROLE_NAMES };
