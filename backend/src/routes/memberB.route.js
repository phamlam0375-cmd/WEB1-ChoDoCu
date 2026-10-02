const express = require("express");

const { requireAuth } = require("../middlewares/auth.middleware");
const uploads = require("../controllers/uploads.controller");
const banks = require("../controllers/banks.controller");
const categories = require("../controllers/categories.controller");
const reports = require("../controllers/reports.controller");
const refunds = require("../controllers/refunds.controller");

// Phân hệ B — các API phía người dùng/người bán (không cần quyền ADMIN).
const router = express.Router();

// Ảnh bằng chứng: body là nguyên file ảnh (image/jpeg hoặc image/png), tối đa 5MB.
router.post(
  "/uploads",
  requireAuth,
  express.raw({ type: ["image/jpeg", "image/png", "application/octet-stream"], limit: uploads.MAX_BYTES }),
  uploads.uploadImage
);

// Thông tin tài khoản đang đăng nhập (vai trò) để giao diện hiển thị đúng menu.
router.get("/me", requireAuth, (req, res) => res.status(200).json({ success: true, data: req.user }));

// B03 Danh mục và tình trạng sản phẩm dùng chung
router.get("/categories", categories.listActiveCategories);
router.get("/categories/conditions", categories.listConditions);

// B04 Gửi và theo dõi báo cáo vi phạm
router.get("/reports/reasons", reports.listReasons);
router.post("/reports", requireAuth, reports.createReport);
router.get("/reports", requireAuth, reports.listMyReports);

// Ngân hàng hỗ trợ mã QR chuyển khoản (tài khoản nhận tiền hoàn)
router.get("/banks", banks.listBanks);

// B06 Gửi, theo dõi và tiếp nhận yêu cầu hoàn tiền
router.get("/refund-requests/reasons", refunds.listReasons);
router.post("/orders/:id/refund-requests", requireAuth, refunds.createRefundRequest);
router.get("/refund-requests", requireAuth, refunds.listMyRefundRequests);
router.get("/refund-requests/:id", requireAuth, refunds.getRefundRequest);
router.patch("/refund-requests/:id", requireAuth, refunds.updateRefundRequest);

module.exports = router;
