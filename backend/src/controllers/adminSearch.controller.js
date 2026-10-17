"use strict";

// Tìm kiếm nhanh trên thanh tiêu đề trang quản trị: tài khoản, tin đăng, báo cáo vi phạm, khoản phí.
const { Op } = require("sequelize");
const { Users, Listings, Reports, Commissions } = require("../models");
const { text } = require("../utils/request");

const LIMIT = 5;

// GET /admin/search?q= — tối đa 5 kết quả mỗi loại.
const quickSearch = async (req, res) => {
  const q = text(req.query.q, "từ khóa", { max: 100 });
  if (!q || (q.length < 2 && !/^\d+$/.test(q))) {
    return res.status(200).json({ success: true, data: { users: [], listings: [], reports: [], commissions: [] } });
  }
  const like = { [Op.like]: `%${q}%` };
  const id = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const byId = (column) => (id ? [{ [column]: id }] : []);

  const [users, listings, reports, commissions] = await Promise.all([
    Users.findAll({
      where: { [Op.or]: [{ FullName: like }, { Email: like }, { Phone: like }, ...byId("UserId")] },
      attributes: ["UserId", "FullName", "Email", "Status"],
      order: [["UserId", "ASC"]],
      limit: LIMIT,
    }),
    Listings.findAll({
      where: { [Op.or]: [{ Title: like }, ...byId("ListingId")] },
      attributes: ["ListingId", "Title", "Price", "Status"],
      order: [["CreatedAt", "DESC"]],
      limit: LIMIT,
    }),
    Reports.findAll({
      where: { [Op.or]: [{ Reason: like }, { Description: like }, ...byId("ReportId")] },
      attributes: ["ReportId", "Reason", "Status", "CreatedAt"],
      order: [["CreatedAt", "DESC"]],
      limit: LIMIT,
    }),
    Commissions.findAll({
      where: { [Op.or]: [{ PaymentReference: like }, ...byId("OrderId")] },
      attributes: ["CommissionId", "OrderId", "PaymentReference", "AmountDue", "Status"],
      order: [["CommissionId", "DESC"]],
      limit: LIMIT,
    }),
  ]);

  return res.status(200).json({ success: true, data: { users, listings, reports, commissions } });
};

module.exports = { quickSearch };
