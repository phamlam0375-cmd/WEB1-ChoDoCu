"use strict";

// Ngân hàng hỗ trợ mã QR chuyển khoản và tài khoản nhận phí của website.
// Dùng chung cho hoàn tiền (tài khoản nhận hoàn) và thu phí (mã QR nộp hoa hồng).
const { BANKS, BANK_BY_CODE } = require("../utils/banks");
const { getSettingsMap } = require("../services/settings.service");

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

module.exports = { listBanks, getFeeAccount };
