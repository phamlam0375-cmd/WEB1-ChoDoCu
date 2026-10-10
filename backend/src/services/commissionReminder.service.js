"use strict";

// Nhắc người bán khi khoản hoa hồng quá hạn nộp (B08/B09).
// Mỗi khoản quá hạn nhận tối đa một thông báo nhắc mỗi ngày (theo giờ Việt Nam).
const { Op } = require("sequelize");
const { Commissions, Notifications } = require("../models");
const { notify } = require("./notification.service");
const { PAYABLE_STATUSES } = require("./commission.service");

const REMINDER_TITLE = "Khoản phí đã quá hạn";
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const formatVnd = (value) => `${Math.round(Number(value)).toLocaleString("vi-VN")}đ`;

// Đầu ngày hôm nay theo giờ Việt Nam (trả về mốc UTC).
const startOfTodayVN = (now) => {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - VN_OFFSET_MS);
};

// Gửi nhắc cho các khoản quá hạn chưa được nhắc hôm nay. Trả về số thông báo đã gửi.
async function remindOverdueCommissions({ sellerId, now = new Date() } = {}) {
  const overdue = await Commissions.findAll({
    where: {
      Status: PAYABLE_STATUSES,
      DueAt: { [Op.lt]: now },
      AmountDue: { [Op.gt]: 0 },
      ...(sellerId ? { SellerId: sellerId } : {}),
    },
    attributes: ["CommissionId", "SellerId", "AmountDue", "DueAt", "PaymentReference"],
  });
  if (!overdue.length) return 0;

  const remindedToday = await Notifications.findAll({
    where: {
      ReferenceType: "COMMISSION",
      ReferenceId: overdue.map((item) => item.CommissionId),
      Title: REMINDER_TITLE,
      CreatedAt: { [Op.gte]: startOfTodayVN(now) },
    },
    attributes: ["ReferenceId"],
  });
  const skip = new Set(remindedToday.map((item) => item.ReferenceId));

  let sent = 0;
  for (const item of overdue) {
    if (skip.has(item.CommissionId)) continue;
    const days = Math.max(1, Math.floor((now.getTime() - new Date(item.DueAt).getTime()) / DAY_MS));
    await notify(item.SellerId, {
      type: "PAYMENT",
      title: REMINDER_TITLE,
      message: `Khoản ${item.PaymentReference} (${formatVnd(item.AmountDue)}) đã quá hạn ${days} ngày. Vui lòng nộp phí sớm tại trang Phí & hoa hồng.`,
      referenceType: "COMMISSION",
      referenceId: item.CommissionId,
    });
    sent += 1;
  }
  return sent;
}

// Chạy nền khi người dùng mở trang phí/hoa hồng; lỗi chỉ ghi log, không ảnh hưởng trang.
const remindInBackground = (options) => {
  remindOverdueCommissions(options).catch((error) => console.error("[commissionReminder]", error.message));
};

module.exports = { remindOverdueCommissions, remindInBackground, REMINDER_TITLE };
