'use strict';
const { HttpError } = require('../../utils/httpError');
const { id } = require('../D07_TaiXeNhanChuyen/assignment.validator');
const invalid = (message, code = 'VALIDATION_ERROR') => new HttpError(400, message, null, code);
function update(body, requestId) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['status', 'note', 'action'].includes(key))) throw invalid('Chỉ gửi trạng thái, ghi chú và loại thao tác D09; không gửi danh tính, thời điểm hoặc dữ liệu xác thực giao hàng.');
  if (body.status === 'DELIVERED') throw invalid('Vui lòng hoàn tất xác thực giao hàng trước.', 'DELIVERY_VERIFICATION_REQUIRED');
  if (!body.status) throw invalid('Vui lòng chọn trạng thái giao hàng.');
  if (body.status !== 'DELIVERING') throw invalid('D09 chỉ hỗ trợ trạng thái DELIVERING.');
  const action = body.action === undefined ? 'START' : body.action;
  if (!['START', 'NOTE'].includes(action)) throw invalid('Loại thao tác phải là START hoặc NOTE.');
  if (body.note !== undefined && typeof body.note !== 'string') throw invalid('Ghi chú phải là văn bản.');
  const note = (body.note || '').trim();
  if ([...note].length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(note)) throw invalid('Ghi chú không được vượt quá 500 ký tự hoặc chứa ký tự điều khiển.');
  if (action === 'NOTE' && !note) throw invalid('Vui lòng nhập ghi chú tiến độ mới.');
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw invalid('Cần Idempotency-Key UUID v4 cho mỗi thao tác D09.', 'IDEMPOTENCY_KEY_REQUIRED');
  return { status: 'DELIVERING', note: note || null, action, requestId: requestId.toLowerCase() };
}
module.exports = { id, update };
