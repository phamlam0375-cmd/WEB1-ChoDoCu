'use strict';

const { HttpError } = require('../utils/httpError');

// Tên/constructor cũ vẫn dùng được, nhưng chỉ còn một hệ thống xử lý lỗi.
class AppError extends HttpError {
  constructor(status, code, message, details) {
    super(status, message, details, code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
