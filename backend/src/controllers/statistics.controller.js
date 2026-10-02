"use strict";

// B10 — Thống kê hoạt động và doanh thu website.
const { sequelize } = require("../models");
const { badRequest } = require("../utils/httpError");
const { APP_UTC_OFFSET, parseDate } = require("../utils/request");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_RANGE_DAYS = 92;
const { SELECT } = sequelize.QueryTypes;

// Ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm.
const localDateKey = (date) => new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

const parseRange = (query) => {
  const to = parseDate(query.to, "Đến ngày", { endOfDay: true })
    || parseDate(localDateKey(new Date()), "Đến ngày", { endOfDay: true });
  const from = parseDate(query.from, "Từ ngày")
    || parseDate(localDateKey(new Date(to.getTime() - 29 * DAY_MS)), "Từ ngày");
  if (from > to) throw badRequest("Từ ngày phải trước hoặc bằng Đến ngày");

  const days = Math.ceil((to - from) / DAY_MS);
  if (days > 366 * 5) throw badRequest("Khoảng thời gian tối đa 5 năm");
  let groupBy = query.groupBy === "month" || query.groupBy === "day" ? query.groupBy : null;
  if (!groupBy) groupBy = days > MAX_DAILY_RANGE_DAYS ? "month" : "day";
  if (groupBy === "day" && days > 366) throw badRequest("Xem theo ngày tối đa 366 ngày, hãy chọn xem theo tháng");
  return { from, to, groupBy };
};

// Danh sách kỳ liên tục để kỳ không có dữ liệu vẫn hiện số 0 trên biểu đồ.
const buildPeriods = ({ from, to, groupBy }) => {
  const periods = [];
  const startKey = localDateKey(from);
  const endKey = localDateKey(to);
  if (groupBy === "day") {
    for (let cursor = new Date(`${startKey}T00:00:00Z`); cursor.toISOString().slice(0, 10) <= endKey; cursor = new Date(cursor.getTime() + DAY_MS)) {
      periods.push(cursor.toISOString().slice(0, 10));
    }
  } else {
    let [year, month] = startKey.slice(0, 7).split("-").map(Number);
    const endMonth = endKey.slice(0, 7);
    for (;;) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (key > endMonth) break;
      periods.push(key);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }
  return periods;
};

const bucket = (column, groupBy) =>
  `DATE_FORMAT(CONVERT_TZ(${column}, '+00:00', '${APP_UTC_OFFSET}'), '${groupBy === "day" ? "%Y-%m-%d" : "%Y-%m"}')`;

const seriesQuery = (sql, replacements) => sequelize.query(sql, { replacements, type: SELECT });

const getStatistics = async (req, res) => {
  const range = parseRange(req.query);
  const { from, to, groupBy } = range;
  const params = { from, to };

  const [completed, cancelled, commissionDue, commissionPaid, vipFees, refunds, newUsers, newListings] = await Promise.all([
    seriesQuery(
      `SELECT ${bucket("CompletedAt", groupBy)} AS period, COUNT(*) AS orders, COALESCE(SUM(ProductAmount), 0) AS gmv
         FROM Orders WHERE Status IN ('COMPLETED','REFUND_PENDING','REFUNDED') AND CompletedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(
      `SELECT ${bucket("CreatedAt", groupBy)} AS period, COUNT(*) AS orders
         FROM Orders WHERE Status = 'CANCELLED' AND CreatedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(
      `SELECT ${bucket("o.CompletedAt", groupBy)} AS period, COALESCE(SUM(c.AmountDue), 0) AS amount
         FROM Commissions c JOIN Orders o ON o.OrderId = c.OrderId
        WHERE c.Status <> 'WAIVED' AND o.CompletedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(
      `SELECT ${bucket("ConfirmedAt", groupBy)} AS period, COALESCE(SUM(AmountDue), 0) AS amount
         FROM Commissions WHERE Status = 'PAID' AND ConfirmedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(
      `SELECT ${bucket("ConfirmedAt", groupBy)} AS period, COALESCE(SUM(FeeAmount), 0) AS amount, COUNT(*) AS count
         FROM ListingPromotions WHERE Status IN ('ACTIVE','EXPIRED') AND ConfirmedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(
      `SELECT ${bucket("CompletedAt", groupBy)} AS period, COUNT(*) AS count, COALESCE(SUM(Amount), 0) AS amount
         FROM RefundRequests WHERE Status = 'COMPLETED' AND CompletedAt BETWEEN :from AND :to GROUP BY period`,
      params
    ),
    seriesQuery(`SELECT COUNT(*) AS total FROM Users WHERE CreatedAt BETWEEN :from AND :to`, params),
    seriesQuery(`SELECT COUNT(*) AS total FROM Listings WHERE CreatedAt BETWEEN :from AND :to`, params),
  ]);

  const [snapshot] = await seriesQuery(
    `SELECT
       (SELECT COALESCE(SUM(AmountDue), 0) FROM Commissions WHERE Status IN ('UNPAID','ADJUSTED','REPORTED')) AS outstandingCommission,
       (SELECT COUNT(*) FROM Commissions WHERE Status IN ('UNPAID','ADJUSTED') AND DueAt < :now) AS overdueCommissions,
       (SELECT COUNT(*) FROM PartnerApplications WHERE Status = 'PENDING') AS pendingPartnerApplications,
       (SELECT COUNT(*) FROM Listings WHERE Status = 'PENDING') AS pendingListings,
       (SELECT COUNT(*) FROM Reports WHERE Status IN ('PENDING','PROCESSING')) AS openReports,
       (SELECT COUNT(*) FROM RefundRequests WHERE Status = 'PENDING') AS pendingRefunds,
       (SELECT COUNT(*) FROM Commissions WHERE Status = 'REPORTED') AS reportedFeePayments`,
    { now: new Date() }
  );

  const topSellers = await seriesQuery(
    `SELECT o.SellerId, u.FullName, COUNT(*) AS orders, COALESCE(SUM(o.ProductAmount), 0) AS gmv
       FROM Orders o JOIN Users u ON u.UserId = o.SellerId
      WHERE o.Status IN ('COMPLETED','REFUND_PENDING','REFUNDED') AND o.CompletedAt BETWEEN :from AND :to
      GROUP BY o.SellerId, u.FullName ORDER BY gmv DESC LIMIT 5`,
    params
  );

  const index = (rows) => Object.fromEntries(rows.map((row) => [row.period, row]));
  const maps = {
    completed: index(completed),
    cancelled: index(cancelled),
    commissionDue: index(commissionDue),
    commissionPaid: index(commissionPaid),
    vipFees: index(vipFees),
    refunds: index(refunds),
  };
  const num = (row, field) => Number(row?.[field] || 0);

  const series = buildPeriods(range).map((period) => {
    const commissionCollected = num(maps.commissionPaid[period], "amount");
    const vip = num(maps.vipFees[period], "amount");
    return {
      period,
      completedOrders: num(maps.completed[period], "orders"),
      cancelledOrders: num(maps.cancelled[period], "orders"),
      gmv: num(maps.completed[period], "gmv"),
      commissionDue: num(maps.commissionDue[period], "amount"),
      commissionCollected,
      vipFees: vip,
      refundAmount: num(maps.refunds[period], "amount"),
      revenue: commissionCollected + vip,
    };
  });

  const sum = (field) => series.reduce((total, row) => total + row[field], 0);
  const summary = {
    completedOrders: sum("completedOrders"),
    cancelledOrders: sum("cancelledOrders"),
    gmv: sum("gmv"),
    commissionDue: sum("commissionDue"),
    commissionCollected: sum("commissionCollected"),
    vipFees: sum("vipFees"),
    vipCount: vipFees.reduce((total, row) => total + Number(row.count), 0),
    refundCount: refunds.reduce((total, row) => total + Number(row.count), 0),
    refundAmount: sum("refundAmount"),
    revenue: sum("revenue"),
    newUsers: Number(newUsers[0].total),
    newListings: Number(newListings[0].total),
  };

  return res.status(200).json({
    success: true,
    data: {
      range: { from: localDateKey(from), to: localDateKey(to), groupBy },
      summary,
      series,
      snapshot: Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, Number(value)])),
      topSellers: topSellers.map((row) => ({ ...row, orders: Number(row.orders), gmv: Number(row.gmv) })),
    },
  });
};

module.exports = { getStatistics };
