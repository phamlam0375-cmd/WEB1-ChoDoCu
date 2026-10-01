const express = require("express");

const { requireAuth } = require("../middlewares/auth.middleware");
const categories = require("../controllers/categories.controller");
const reports = require("../controllers/reports.controller");
const refunds = require("../controllers/refunds.controller");
const commissions = require("../controllers/commissions.controller");

// Phân hệ B — các API phía người dùng/người bán (không cần quyền ADMIN).
const router = express.Router();

// Thông tin tài khoản đang đăng nhập (vai trò) để giao diện hiển thị đúng menu.
router.get("/me", requireAuth, (req, res) => res.status(200).json({ success: true, data: req.user }));

// B03 Danh mục và tình trạng sản phẩm dùng chung
router.get("/categories", categories.listActiveCategories);
router.get("/categories/conditions", categories.listConditions);

// B04 Gửi và theo dõi báo cáo vi phạm
router.get("/reports/reasons", reports.listReasons);
router.post("/reports", requireAuth, reports.createReport);
router.get("/reports", requireAuth, reports.listMyReports);

// B06 Gửi yêu cầu hoàn tiền; B07 các bước giải quyết (admin, người bán, người mua)
router.post("/orders/:id/refund-requests", requireAuth, refunds.createRefundRequest);
router.get("/refund-requests", requireAuth, refunds.listMyRefundRequests);
router.get("/refund-requests/:id", requireAuth, refunds.getRefundRequest);
router.patch("/refund-requests/:id", requireAuth, refunds.updateRefundRequest);

// B08 + B09 Người bán xem hoa hồng, phí còn nợ và báo đã nộp
router.get("/seller/commissions", requireAuth, commissions.listSellerCommissions);
router.get("/seller/fee-payments", requireAuth, commissions.getSellerFeeOverview);
router.post("/seller/fee-payments", requireAuth, commissions.reportFeePayment);

module.exports = router;
