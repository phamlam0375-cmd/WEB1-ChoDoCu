const express = require("express");

const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const users = require("../controllers/adminUsers.controller");
const partners = require("../controllers/adminPartnerApplications.controller");
const categories = require("../controllers/categories.controller");
const reports = require("../controllers/reports.controller");
const listings = require("../controllers/adminListings.controller");
const refunds = require("../controllers/refunds.controller");
const commissions = require("../controllers/commissions.controller");
const statistics = require("../controllers/statistics.controller");
const auditLogs = require("../controllers/auditLogs.controller");
const settings = require("../controllers/settings.controller");

// Phân hệ B: mọi API /api/v1/admin/* yêu cầu đăng nhập và vai trò ADMIN.
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

// B01 Quản lý tài khoản và phân quyền
router.get("/users", users.listUsers);
router.get("/users/:id", users.getUser);
router.patch("/users/:id", users.updateUser);

// B02 Duyệt đăng ký đối tác
router.get("/partner-applications", partners.listApplications);
router.get("/partner-applications/:id", partners.getApplication);
router.get("/partner-applications/:id/identity-image", partners.getIdentityImage);
router.patch("/partner-applications/:id", partners.reviewApplication);

// B03 Quản lý danh mục và lựa chọn tình trạng
router.get("/categories", categories.listCategories);
router.post("/categories", categories.createCategory);
router.patch("/categories/:id", categories.updateCategory);
router.delete("/categories/:id", categories.deleteCategory);
router.get("/conditions", categories.listAllConditions);
router.post("/conditions", categories.createCondition);
router.patch("/conditions/:code", categories.updateCondition);

// B04 Tiếp nhận báo cáo vi phạm (xử lý báo cáo dùng chung với B05)
router.get("/reports", reports.listReports);
router.get("/reports/:id", reports.getReport);
router.patch("/reports/:id", reports.handleReport);

// B05 Kiểm duyệt tin
router.get("/listings", listings.listListings);
router.get("/listings/:id", listings.getListing);
router.patch("/listings/:id/review", listings.reviewListing);

// B06 Tiếp nhận yêu cầu hoàn tiền (các bước xử lý ở PATCH /refund-requests/:id)
router.get("/refund-requests", refunds.listRefundRequests);

// B08 Hoa hồng theo đơn
router.get("/commissions", commissions.listCommissions);
router.post("/commissions/sync", commissions.syncCommissions);
router.post("/commissions/remind-overdue", commissions.remindOverdue);

// B09 Thu và đối soát phí
router.get("/fee-payments", commissions.listFeePayments);
router.get("/fee-payments/debtors", commissions.listDebtors);
router.patch("/fee-payments/:id", commissions.reviewFeePayment);

// B10 Thống kê
router.get("/statistics", statistics.getStatistics);

// B11 Nhật ký thao tác quản trị — chỉ đọc
router.get("/audit-logs", auditLogs.listAuditLogs);
router.get("/audit-logs/meta", auditLogs.getAuditLogMeta);
router.get("/audit-logs/export", auditLogs.exportAuditLogs);

// B12 Cấu hình quy tắc hệ thống
router.get("/settings", settings.getSettings);
router.put("/settings", settings.saveSettings);

module.exports = router;
