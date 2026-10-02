"use strict";

// Cấu hình quy tắc hệ thống. Có hiệu lực ngay sau khi lưu, mỗi thay đổi tự ghi nhật ký thao tác.
const { text } = require("../utils/request");
const { listSettings, updateSettings } = require("../services/settings.service");

const getSettings = async (_req, res) => {
  const settings = await listSettings();
  return res.status(200).json({ success: true, data: settings });
};

// PUT /admin/settings { changes: { KEY: value }, reason, version }
const saveSettings = async (req, res) => {
  const reason = text(req.body.reason, "lý do thay đổi", { required: true, min: 5, max: 500 });
  const applied = await updateSettings(req, req.body.changes, reason, req.body.version);
  const settings = await listSettings();
  return res.status(200).json({
    success: true,
    message: "Lưu thành công",
    data: { applied, settings },
  });
};

module.exports = { getSettings, saveSettings };
