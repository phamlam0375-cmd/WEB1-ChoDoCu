'use strict';

const { HttpError } = require('../../utils/httpError');

function validateOrderId(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 4294967295) {
    throw new HttpError(400, 'Mã đơn hàng không hợp lệ.', null, 'VALIDATION_ERROR');
  }
  return Number(value);
}

function validateCancelReason(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.reason !== 'string' || !body.reason.trim()) {
    throw new HttpError(400, 'Vui lòng chọn lý do hủy đơn.', null, 'VALIDATION_ERROR');
  }
  if (Object.keys(body).some(key => key !== 'reason')) {
    throw new HttpError(400, 'Chỉ gửi lý do hủy; tài khoản và trạng thái do máy chủ xác định.', null, 'VALIDATION_ERROR');
  }
  const reason = body.reason.trim();
  if ([...reason].length > 500) {
    throw new HttpError(400, 'Lý do hủy đơn tối đa 500 ký tự.', null, 'VALIDATION_ERROR');
  }
  return reason;
}

module.exports = { validateOrderId, validateCancelReason };
