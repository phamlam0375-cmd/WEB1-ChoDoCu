'use strict';
const { HttpError } = require('../../utils/httpError');
const { validateProof } = require('../D03_ThanhToan/payment.validator');
const { id } = require('../D07_TaiXeNhanChuyen/assignment.validator');
const INVALID_CODE = 'Mã xác nhận không đúng hoặc đã hết hiệu lực.';
const INVALID_IMAGE = 'Chỉ chấp nhận JPG hoặc PNG tối đa 5 MB.';
const invalid = message => new HttpError(400, message, null, 'VALIDATION_ERROR');
function object(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) throw invalid('Chỉ gửi dữ liệu xác nhận; danh tính, trạng thái, thời gian và đường dẫn ảnh do máy chủ xác định.');
}
function issue(body) {
  object(body, ['handoverConfirmed']);
  if (body.handoverConfirmed !== true) throw invalid('Người bán phải chủ động xác nhận đã kiểm tra và bàn giao cho đúng tài xế.');
}
function pickup(body) {
  object(body, ['pickupCode', 'packageIntact']);
  if (body.packageIntact !== true) throw invalid('Vui lòng xác nhận kiện hàng còn nguyên vẹn.');
  // Không coerce number: giữ nguyên số 0 đầu, không nhận mã qua URL.
  if (typeof body.pickupCode !== 'string' || !/^\d{6}$/.test(body.pickupCode)) throw invalid(INVALID_CODE);
  return { pickupCode: body.pickupCode };
}
function image(file) {
  if (!file) return null;
  try { return validateProof(file); } catch { throw new HttpError(400, INVALID_IMAGE, null, 'INVALID_PROOF'); }
}
module.exports = { id, issue, pickup, image, INVALID_CODE, INVALID_IMAGE };
