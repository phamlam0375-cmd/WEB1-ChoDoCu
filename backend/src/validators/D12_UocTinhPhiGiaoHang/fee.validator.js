'use strict';
const { HttpError } = require('../../utils/httpError');
const { toCents, fromCents } = require('../../utils/money');
const fail = (message, field) => new HttpError(422, message, field ? { fields: { [field]: message } } : null, 'DELIVERY_VALIDATION');
const normalized = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');
function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw fail(field === 'deliveryArea' ? 'Vui lòng chọn đầy đủ khu vực giao nhận.' : `Thông tin ${field} không hợp lệ.`, field);
  return normalized(value);
}
const key = value => typeof value === 'string' ? normalized(value).toLocaleLowerCase('vi-VN') : '';
function id(value, field = 'listingId') {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 4294967295) throw fail('Mã sản phẩm không hợp lệ.', field);
  return Number(value);
}
function estimate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['listingId', 'deliveryArea', 'vehicleType', 'receiverAddress'].includes(k))) throw fail('Chỉ gửi sản phẩm, khu vực nhận, phương tiện và địa chỉ; điểm lấy/phí do máy chủ xác định.');
  return { listingId: id(body.listingId), deliveryArea: text(body.deliveryArea, 100, 'deliveryArea'), vehicleType: text(body.vehicleType, 30, 'vehicleType'), receiverAddress: text(body.receiverAddress, 255, 'receiverAddress') };
}
function rule(row) {
  try {
    const pickupArea = text(row.PickupArea, 100, 'PickupArea'), deliveryArea = text(row.DeliveryArea, 100, 'DeliveryArea'), vehicleType = text(row.VehicleType, 30, 'VehicleType');
    const cents = toCents(row.FeeAmount);
    if (cents > 999999999999999999n || (row.EstimatedMinutes !== null && row.EstimatedMinutes !== undefined && (!Number.isInteger(Number(row.EstimatedMinutes)) || Number(row.EstimatedMinutes) <= 0 || Number(row.EstimatedMinutes) > 2147483647))) throw new Error();
    return { ruleId: id(row.RuleId), pickupArea, deliveryArea, vehicleType, amount: fromCents(cents), estimatedMinutes: row.EstimatedMinutes == null ? null : Number(row.EstimatedMinutes), updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : null };
  } catch { throw new HttpError(409, 'Quy tắc phí đang có dữ liệu không hợp lệ. Vui lòng liên hệ quản trị.', null, 'DELIVERY_RULE_INVALID'); }
}
module.exports = { estimate, text, key, id, rule };
