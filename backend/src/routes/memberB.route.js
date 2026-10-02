const express = require("express");

const { requireAuth } = require("../middlewares/auth.middleware");
const uploads = require("../controllers/uploads.controller");

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

module.exports = router;
