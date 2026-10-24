'use strict';

const { HttpError } = require('../../utils/httpError');
const { validateOrderId } = require('../D03_ThanhToan/payment.validator');
const { parsePagination } = require('../../utils/request');
const invalid = message => new HttpError(400, message, null, 'VALIDATION_ERROR');

function validateDecision(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['action', 'reportVersion', 'note'].includes(key))) {
    throw invalid('Chỉ gửi kết quả đối chiếu, phiên báo thanh toán và ghi chú.');
  }
  if (!['CONFIRM', 'REJECT'].includes(body.action)) throw invalid('Vui lòng chọn Đã nhận đủ hoặc Chưa nhận được.');
  if (typeof body.reportVersion !== 'string' || !/^[a-f0-9]{64}$/.test(body.reportVersion)) {
    throw invalid('Thiếu phiên báo thanh toán hợp lệ. Vui lòng tải lại giao dịch.');
  }
  if (body.note !== undefined && typeof body.note !== 'string') throw invalid('Ghi chú phải là văn bản.');
  const note = (body.note || '').trim();
  if (note.length > 250 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(note)) throw invalid('Ghi chú tối đa 250 ký tự hợp lệ.');
  const decision = { action: body.action, reportVersion: body.reportVersion, note };
  // Giữ metadata của quyết định trong lịch sử chung, không sửa schema/payment D03.
  const historyNote = `D04 ${JSON.stringify(decision)}`;
  if (historyNote.length > 500) throw invalid('Ghi chú có quá nhiều ký tự cần mã hóa; vui lòng rút ngắn.');
  return { ...decision, historyNote };
}

function validateList(query) {
  const status = query.status || 'REPORTED';
  if (!['REPORTED', 'REJECTED', 'CONFIRMED', 'WAITING', 'ALL'].includes(status)) throw invalid('Trạng thái lọc không hợp lệ.');
  for (const key of ['page', 'limit']) {
    if (query[key] !== undefined && (!/^\d+$/.test(String(query[key])) || !Number.isSafeInteger(Number(query[key])) || Number(query[key]) < 1)) {
      throw invalid('Phân trang không hợp lệ.');
    }
  }
  const pagination = parsePagination(query);
  if (!Number.isSafeInteger(pagination.offset)) throw invalid('Phân trang không hợp lệ.');
  return { ...pagination, status };
}

module.exports = { validateOrderId, validateDecision, validateList };
