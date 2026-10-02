"use strict";

// Cấu hình quy tắc hệ thống. Có hiệu lực ngay sau khi lưu, mỗi thay đổi tự ghi nhật ký thao tác.
const { text } = require("../utils/request");
const { BANKS, BANK_BY_CODE } = require("../utils/banks");
const { getSettingsMap, listSettings, updateSettings } = require("../services/settings.service");

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

// GET /banks — ngân hàng hỗ trợ chuyển khoản bằng mã QR (VietQR).
const listBanks = (_req, res) => res.status(200).json({ success: true, data: BANKS });

// GET /fee-account — tài khoản nhận phí của website, dùng để tạo mã QR nộp hoa hồng.
const getFeeAccount = async (_req, res) => {
  const settings = await getSettingsMap();
  const bank = BANK_BY_CODE[settings.FEE_BANK_CODE];
  return res.status(200).json({
    success: true,
    data: {
      bankCode: settings.FEE_BANK_CODE,
      bankName: bank ? bank.shortName : settings.FEE_BANK_CODE,
      accountNumber: settings.FEE_BANK_ACCOUNT_NUMBER,
      accountHolder: settings.FEE_BANK_ACCOUNT_HOLDER,
    },
  });
};

module.exports = { getSettings, saveSettings, listBanks, getFeeAccount };
