const express = require("express");

const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const users = require("../controllers/adminUsers.controller");

// Phân hệ B: mọi API /api/v1/admin/* yêu cầu đăng nhập và vai trò ADMIN.
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

// B01 Quản lý tài khoản và phân quyền
router.get("/users", users.listUsers);
router.get("/users/:id", users.getUser);
router.patch("/users/:id", users.updateUser);

module.exports = router;
