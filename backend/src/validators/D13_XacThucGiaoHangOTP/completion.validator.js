'use strict';
const { HttpError } = require('../../utils/httpError');
const { id } = require('../D07_TaiXeNhanChuyen/assignment.validator');
const { validateProof } = require('../D03_ThanhToan/payment.validator');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hiệu lực.';
const LOCKED = 'Tạm khóa xác thực; người mua cần tạo mã mới.';
const PROOF_REQUIRED = 'Vui lòng bổ sung đầy đủ bằng chứng giao hàng.';
const invalid = (message, code = 'COMPLETION_VALIDATION') => new HttpError(400, message, null, code);
function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) throw invalid('Chỉ gửi mã, phiên mã và xác nhận bàn giao; danh tính, thời điểm, trạng thái và ảnh do máy chủ kiểm soát.');
}
function key(value) { if (typeof value !== 'string' || !UUID.test(value)) throw invalid('Cần Idempotency-Key UUID v4 cho thao tác xác thực.', 'IDEMPOTENCY_KEY_REQUIRED'); return value.toLowerCase(); }
const issue = body => object(body, []);
const whitelist = body => object(body, ['completionCode', 'codeSession', 'handoverConfirmed']);
function complete(body) {
  whitelist(body);
  if (body.handoverConfirmed !== true) throw invalid(PROOF_REQUIRED, 'COMPLETION_PROOF_REQUIRED');
  if (typeof body.completionCode !== 'string' || !/^\d{6}$/.test(body.completionCode)) throw invalid(INVALID_CODE, 'INVALID_COMPLETION_CODE');
  if (typeof body.codeSession !== 'string' || !UUID.test(body.codeSession)) throw invalid('Thiếu phiên mã hợp lệ. Hãy tải lại chuyến.', 'COMPLETION_SESSION_REQUIRED');
  return { completionCode: body.completionCode, codeSession: body.codeSession.toLowerCase(), handoverConfirmed: true };
}
function image(file) {
  if (!file) throw invalid(PROOF_REQUIRED, 'COMPLETION_PROOF_REQUIRED');
  try {
    const extension = validateProof(file);
    if (file.mimetype !== undefined && file.mimetype !== (extension === 'png' ? 'image/png' : 'image/jpeg')) throw new Error();
    return extension;
  } catch { throw invalid('Ảnh bàn giao phải là JPG/PNG hợp lệ, tối đa 5 MB.', 'INVALID_COMPLETION_PROOF'); }
}
module.exports = { id, key, issue, whitelist, complete, image, UUID, INVALID_CODE, LOCKED, PROOF_REQUIRED };
