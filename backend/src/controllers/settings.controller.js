"use strict";

// B12 — Cấu hình quy tắc hệ thống. Có hiệu lực ngay sau khi lưu, mỗi thay đổi tự ghi nhật ký B11.
const { text } = require("../utils/request");
const { listSettings, updateSettings } = require("../services/settings.service");

const getSettings = async (_req, res) => {
  const settings = await listSettings();
  return res.status(200).json({ success: true, data: settings });
};

// PUT /admin/settings { changes: { KEY: value }, reason }
const saveSettings = async (req, res) => {
  const reason = text(req.body.reason, "lý do thay đổi", { required: true, min: 5, max: 500 });
  const applied = await updateSettings(req, req.body.changes, reason);
  const settings = await listSettings();
  return res.status(200).json({
    success: true,
    message: `Đã lưu ${applied.length} thay đổi. Cấu hình áp dụng cho đơn và khoản phát sinh từ bây giờ.`,
    data: { applied, settings },
  });
};

module.exports = { getSettings, saveSettings };
