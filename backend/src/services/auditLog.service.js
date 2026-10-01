"use strict";

const { AdminAuditLogs } = require("../models");
const { clientIp } = require("../utils/request");

// B11: danh mục hành động được ghi nhật ký, dùng cho cả bộ lọc và hiển thị.
const AUDIT_ACTIONS = {
  USER_LOCK: "Khóa tài khoản",
  USER_UNLOCK: "Mở khóa tài khoản",
  USER_ROLES_UPDATE: "Cập nhật vai trò",
  PARTNER_APPROVE: "Duyệt hồ sơ đối tác",
  PARTNER_REJECT: "Từ chối hồ sơ đối tác",
  PARTNER_NEED_INFO: "Yêu cầu bổ sung hồ sơ",
  CATEGORY_CREATE: "Thêm danh mục",
  CATEGORY_UPDATE: "Sửa danh mục",
  LISTING_APPROVE: "Duyệt tin đăng",
  LISTING_REJECT: "Từ chối tin đăng",
  LISTING_HIDE: "Gỡ (ẩn) tin đăng",
  LISTING_RESTORE: "Khôi phục tin đăng",
  REPORT_PROCESS: "Tiếp nhận xử lý báo cáo",
  REPORT_RESOLVE: "Kết luận báo cáo vi phạm",
  REPORT_REJECT: "Bác bỏ báo cáo",
  REFUND_APPROVE: "Duyệt hoàn tiền",
  REFUND_REJECT: "Từ chối hoàn tiền",
  REFUND_COMPLETE: "Xác nhận hoàn tiền xong",
  COMMISSION_SYNC: "Tạo hoa hồng cho đơn hoàn tất",
  FEE_CONFIRM: "Xác nhận đã thu phí",
  FEE_REJECT: "Từ chối báo nộp phí",
  FEE_WAIVE: "Miễn phí hoa hồng",
  SETTING_UPDATE: "Đổi cấu hình",
};

const TARGET_TYPES = {
  USER: "Tài khoản",
  PARTNER_APPLICATION: "Hồ sơ đối tác",
  CATEGORY: "Danh mục",
  LISTING: "Tin đăng",
  REPORT: "Báo cáo vi phạm",
  REFUND_REQUEST: "Yêu cầu hoàn tiền",
  COMMISSION: "Hoa hồng / phí",
  SETTING: "Cấu hình",
};

const serialize = (value) => {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
};

// Ghi một dòng nhật ký. Gọi trong cùng transaction với thao tác để thao tác
// và dấu vết cùng thành công hoặc cùng bị hủy.
const logAdminAction = (req, { action, targetType, targetId, oldValue, newValue, note }, { transaction } = {}) => {
  if (!AUDIT_ACTIONS[action]) throw new Error(`Hành động nhật ký không hợp lệ: ${action}`);
  if (!TARGET_TYPES[targetType]) throw new Error(`Loại đối tượng nhật ký không hợp lệ: ${targetType}`);

  return AdminAuditLogs.create(
    {
      AdminId: req.user.UserId,
      Action: action,
      TargetType: targetType,
      TargetId: targetId === undefined || targetId === null ? null : String(targetId),
      OldValue: serialize(oldValue),
      NewValue: serialize(newValue),
      Note: note ? String(note).slice(0, 500) : null,
      IpAddress: clientIp(req),
    },
    { transaction }
  );
};

module.exports = { AUDIT_ACTIONS, TARGET_TYPES, logAdminAction };
