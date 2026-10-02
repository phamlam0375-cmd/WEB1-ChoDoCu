const express = require("express");

const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const users = require("../controllers/adminUsers.controller");
const partners = require("../controllers/adminPartnerApplications.controller");

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
router.patch("/partner-applications/:id", partners.reviewApplication);

module.exports = router;
