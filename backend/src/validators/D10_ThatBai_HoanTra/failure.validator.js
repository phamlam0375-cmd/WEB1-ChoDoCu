'use strict';
const { HttpError } = require('../../utils/httpError');
const { id } = require('../D07_TaiXeNhanChuyen/assignment.validator');
const fail = (message, code = 'VALIDATION_ERROR') => new HttpError(400, message, null, code);
const REASONS = { UNAVAILABLE: 'Không liên hệ được người nhận', ADDRESS: 'Địa chỉ giao hàng không phù hợp', REFUSED: 'Người nhận từ chối nhận', PACKAGE: 'Sự cố kiện hàng', OTHER: 'Lý do khác' };
function text(value, limit, required = false) {
  if (value !== undefined && typeof value !== 'string') throw fail('Nội dung phải là văn bản.');
  const result = (value || '').trim();
  if ((required && !result) || [...result].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) throw fail('Nội dung thiếu, quá giới hạn hoặc chứa ký tự điều khiển.');
  return result || null;
}
function dateWithZone(value) {
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(Z|[+-](\d\d):(\d\d))$/);
  if (!m) throw fail('Vui lòng chọn lịch giao lại có múi giờ.');
  const [, year, month, day, hour, minute, second, zone, offsetHour, offsetMinute] = m;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const date = new Date(value);
  if (Number(year) < 1000 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (zone !== 'Z' && (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) || !Number.isFinite(date.getTime())) throw fail('Lịch giao lại không hợp lệ.');
  // Schema nhóm dùng DATETIME giây: làm tròn lên, không bắt đầu sớm hơn giờ hẹn.
  return new Date(Math.ceil(date.getTime() / 1000) * 1000).toISOString();
}
function validate(body, key, version, route) {
  const keys = route === 'failure' ? ['action', 'reasonCode', 'note', 'scheduledAt'] : ['action', 'handoverConfirmed', 'recipientName', 'note'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k))) throw fail('Chỉ gửi dữ liệu D10; danh tính, số đếm, thời điểm và đường dẫn ảnh do server quản lý.');
  const actions = route === 'failure' ? ['FAIL', 'SCHEDULE', 'RETRY'] : ['START_RETURN', 'CONFIRM_RETURN'];
  if (!actions.includes(body.action)) throw fail('Thao tác D10 không hợp lệ.');
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw fail('Cần Idempotency-Key UUID v4.', 'IDEMPOTENCY_KEY_REQUIRED');
  if (typeof version !== 'string' || !/^"d10-[1-9]\d*-\d+-[A-Z_]+"$/.test(version)) throw fail('Cần If-Match từ phiên bản chuyến mới nhất.', 'DELIVERY_VERSION_REQUIRED');
  const result = { action: body.action, key: key.toLowerCase(), version, note: text(body.note, 500) };
  if (body.action === 'FAIL') {
    if (!Object.hasOwn(REASONS, body.reasonCode)) throw fail('Vui lòng chọn lý do giao không thành công.');
    if (body.reasonCode === 'OTHER' && !result.note) throw fail('Vui lòng mô tả lý do khác.');
    result.reasonCode = body.reasonCode;
    result.reason = REASONS[body.reasonCode] + (result.note ? ': ' + result.note : '');
    if ([...result.reason].length > 500) throw fail('Lý do và ghi chú không được vượt quá 500 ký tự.');
  } else if (body.reasonCode !== undefined) throw fail('Lý do chỉ dùng khi ghi nhận thất bại.');
  if (body.action === 'SCHEDULE') result.scheduledAt = dateWithZone(body.scheduledAt);
  else if (body.scheduledAt !== undefined) throw fail('Lịch chỉ dùng khi hẹn giao lại.');
  if (body.action === 'CONFIRM_RETURN') {
    if (body.handoverConfirmed !== true) throw fail('Vui lòng xác nhận đã bàn giao trả hàng thực tế.');
    result.recipientName = text(body.recipientName, 100, true);
  } else if (body.handoverConfirmed !== undefined || body.recipientName !== undefined) throw fail('Thông tin bàn giao chỉ dùng khi xác nhận đã trả.');
  return result;
}
module.exports = { id, validate, text, dateWithZone, REASONS };
