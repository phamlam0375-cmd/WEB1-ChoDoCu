"use strict";

const { HttpError } = require("../utils/httpError");

// Express 5 tự chuyển lỗi của hàm async vào đây, controller không cần try/catch.
// eslint-disable-next-line no-unused-vars
const errorHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
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

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Nội dung JSON không hợp lệ" });
  }

  console.error(error);
  return res.status(500).json({ success: false, message: "Lỗi server" });
};

module.exports = errorHandler;
