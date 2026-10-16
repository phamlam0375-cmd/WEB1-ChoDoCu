'use strict';
const { HttpError } = require('../../utils/httpError');
const { validateOrderId } = require('../D03_ThanhToan/payment.validator');

function validateConfirmation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => key !== 'received')) {
    throw new HttpError(400, 'Chỉ gửi xác nhận nhận sản phẩm; danh tính và trạng thái do máy chủ xác định.', null, 'VALIDATION_ERROR');
  }
  if (body.received !== true) throw new HttpError(400, 'Vui lòng xác nhận bạn đã nhận sản phẩm.', null, 'RECEIPT_CONFIRMATION_REQUIRED');
}
module.exports = { validateOrderId, validateConfirmation };
