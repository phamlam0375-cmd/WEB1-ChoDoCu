const express = require("express");

const { requireAuth, requireRole } = require("../middlewares/auth.middleware");

// Phân hệ B: mọi API /api/v1/admin/* yêu cầu đăng nhập và vai trò ADMIN.
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

module.exports = router;
