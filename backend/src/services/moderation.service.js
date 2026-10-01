"use strict";

const { Op } = require("sequelize");
const { Orders, Users, Roles } = require("../models");
const { badRequest, conflict } = require("../utils/httpError");
const { logAdminAction } = require("./auditLog.service");
const { notify } = require("./notification.service");

// B05: các hành động kiểm duyệt tin, trạng thái được phép và trạng thái đích.
const LISTING_ACTIONS = {
  APPROVE: { from: ["PENDING"], audit: "LISTING_APPROVE", noteRequired: false, title: "Tin đăng đã được duyệt" },
  REJECT: { from: ["PENDING"], audit: "LISTING_REJECT", noteRequired: true, title: "Tin đăng bị từ chối" },
  HIDE: { from: ["PENDING", "ACTIVE", "RESERVED"], audit: "LISTING_HIDE", noteRequired: true, title: "Tin đăng bị gỡ" },
  RESTORE: { from: ["HIDDEN"], audit: "LISTING_RESTORE", noteRequired: false, title: "Tin đăng được khôi phục" },
};

const OPEN_ORDER_STATUSES = ["RESERVED", "WAITING_PAYMENT", "PAID", "IN_DELIVERY", "DELIVERED", "REFUND_PENDING"];

const nextListingStatus = async (listing, action, transaction) => {
  if (action === "APPROVE") return "ACTIVE";
  if (action === "REJECT") return "REJECTED";
  if (action === "HIDE") return "HIDDEN";
  // Khôi phục tin đang có đơn dở dang thì trả về RESERVED để không bán trùng.
  const openOrder = await Orders.count({
    where: { ListingId: listing.ListingId, Status: { [Op.in]: OPEN_ORDER_STATUSES } },
    transaction,
  });
  return openOrder ? "RESERVED" : "ACTIVE";
};

const moderateListing = async (req, listing, action, note, { transaction, source } = {}) => {
  const rule = LISTING_ACTIONS[action];
  if (!rule) throw badRequest("Hành động kiểm duyệt không hợp lệ");
  if (!rule.from.includes(listing.Status)) {
    throw conflict(`Không thể thực hiện với tin đang ở trạng thái ${listing.Status}`);
  }
  if (rule.noteRequired && !note) throw badRequest("Vui lòng nhập lý do");

  const oldStatus = listing.Status;
  const newStatus = await nextListingStatus(listing, action, transaction);
  await listing.update(
    { Status: newStatus, ModerationNote: note || null, UpdatedAt: new Date() },
    { transaction }
  );

  await logAdminAction(
    req,
    {
      action: rule.audit,
      targetType: "LISTING",
      targetId: listing.ListingId,
      oldValue: { Status: oldStatus },
      newValue: { Status: newStatus },
      note: [source, note].filter(Boolean).join(" — "),
    },
    { transaction }
  );

  await notify(
    listing.SellerId,
    {
      type: "LISTING",
      title: rule.title,
      message: `Tin "${listing.Title}"${note ? `: ${note}` : "."}`,
      referenceType: "LISTING",
      referenceId: listing.ListingId,
    },
    { transaction }
  );

  return { oldStatus, newStatus };
};

// B01/B05: khóa hoặc mở khóa tài khoản, không cho tự khóa mình.
const setUserStatus = async (req, user, status, reason, { transaction, source } = {}) => {
  if (user.Status === status) return false;
  if (status === "LOCKED" && user.UserId === req.user.UserId) {
    throw badRequest("Không thể tự khóa tài khoản của chính mình");
  }

  const oldStatus = user.Status;
  await user.update({ Status: status, UpdatedAt: new Date() }, { transaction });

  await logAdminAction(
    req,
    {
      action: status === "LOCKED" ? "USER_LOCK" : "USER_UNLOCK",
      targetType: "USER",
      targetId: user.UserId,
      oldValue: { Status: oldStatus },
      newValue: { Status: status },
      note: [source, reason].filter(Boolean).join(" — "),
    },
    { transaction }
  );

  await notify(
    user.UserId,
    {
      type: "SYSTEM",
      title: status === "LOCKED" ? "Tài khoản bị khóa" : "Tài khoản được mở khóa",
      message: reason || "Quản trị viên đã cập nhật trạng thái tài khoản của bạn.",
      referenceType: "USER",
      referenceId: user.UserId,
    },
    { transaction }
  );
  return true;
};

const isAdminUser = async (userId, transaction) => {
  const user = await Users.findByPk(userId, {
    include: [{ model: Roles, as: "Roles", where: { RoleName: "ADMIN" }, required: true }],
    transaction,
  });
  return Boolean(user);
};

module.exports = { LISTING_ACTIONS, moderateListing, setUserStatus, isAdminUser };
