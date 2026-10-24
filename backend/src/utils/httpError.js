"use strict";

// Lỗi nghiệp vụ có mã HTTP; errorHandler sẽ trả về { success: false, message, errors }.
class HttpError extends Error {
  constructor(status, message, errors, code) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

const badRequest = (message, errors) => new HttpError(400, message, errors);
const forbidden = (message = "Bạn không có quyền thực hiện thao tác này") => new HttpError(403, message);
const notFound = (message = "Không tìm thấy dữ liệu") => new HttpError(404, message);
const conflict = (message) => new HttpError(409, message);

module.exports = { HttpError, badRequest, forbidden, notFound, conflict };
