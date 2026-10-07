"use strict";

const { HttpError } = require("../utils/httpError");

// Express 5 tự chuyển lỗi của hàm async vào đây, controller không cần try/catch.
// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.errors ? { errors: error.errors } : {}),
      // Tương thích client /api/orders đọc error.code và error.details.
      error: {
        code: error.code || 'HTTP_ERROR',
        message: error.message,
        ...((error.details ?? error.errors) ? { details: error.details ?? error.errors } : {}),
      },
    });
  }

  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: error.errors.map((item) => item.message),
    });
  }

  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ success: false, message: "Dữ liệu đã tồn tại" });
  }

  if (error.type === "entity.too.large") {
    const isUpload = req.originalUrl.includes("/uploads");
    return res.status(413).json({
      success: false,
      message: isUpload ? "Chỉ chấp nhận ảnh JPG, PNG, tối đa 5MB" : "Dữ liệu gửi lên quá lớn",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Nội dung JSON không hợp lệ" });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Lỗi server",
    error: { code: "INTERNAL_ERROR", message: "Lỗi server" },
  });
};

module.exports = errorHandler;
