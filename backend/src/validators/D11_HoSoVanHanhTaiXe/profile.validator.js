'use strict';
const { HttpError } = require('../../utils/httpError');
const { bankDetails } = require('../D03_ThanhToan/payment.validator');
const limits = { VehicleType: 30, VehiclePlate: 20, ServiceArea: 255, BankName: 80, BankAccountNumber: 30, BankAccountHolder: 100 };
const bankFields = ['BankName', 'BankAccountNumber', 'BankAccountHolder'];
const invalid = (message, field) => new HttpError(400, message, field ? { field } : null, 'PROFILE_VALIDATION');
function object(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Nội dung hồ sơ không hợp lệ.');
}
function radius(value) {
  if (value === null) return null;
  if (typeof value === 'string') value = value.trim();
  if (!['string', 'number'].includes(typeof value) || !/^\d{1,4}(?:\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 9999.99) throw invalid('Bán kính phải từ 0.01 đến 9999.99 km hoặc để trống.', 'MaxDistanceKm');
  return Number(value).toFixed(2);
}
function patch(body) {
  object(body);
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'RemoveQr') { if (typeof value !== 'boolean') throw invalid('Yêu cầu xóa QR không hợp lệ.', key); result[key] = value; }
    else if (key === 'MaxDistanceKm') result[key] = radius(value);
    else if (Object.hasOwn(limits, key)) {
      if (value === null && bankFields.includes(key)) { result[key] = null; continue; }
      if (typeof value !== 'string' || value.trim().length > limits[key] || /[\x00-\x1f\x7f]/.test(value)) throw invalid(`Trường ${key} không hợp lệ (tối đa ${limits[key]} ký tự).`, key);
      result[key] = value.trim() || null;
      if (key === 'VehiclePlate' && result[key]) result[key] = result[key].toUpperCase().replace(/ +/g, ' ');
    } else throw invalid(`Không được cập nhật trường ${key}.`, key);
  }
  return result;
}
function operationErrors(p) {
  const missing = [];
  for (const key of ['VehicleType', 'VehiclePlate', 'ServiceArea']) if (typeof p?.[key] !== 'string' || !p[key].trim() || p[key].length > limits[key] || /[\x00-\x1f\x7f]/.test(p[key])) missing.push(key);
  if (p?.MaxDistanceKm != null) { try { radius(p.MaxDistanceKm); } catch { missing.push('MaxDistanceKm'); } }
  return missing;
}
function validateMerged(p) {
  const missing = operationErrors(p);
  if (missing.length) throw invalid('Vui lòng nhập đầy đủ thông tin vận hành.', missing[0]);
  if (bankFields.some(k => p[k] != null && p[k] !== '') && !bankDetails(p)) throw invalid('Vui lòng nhập đủ ngân hàng, số tài khoản dạng chuỗi chữ số và tên chủ tài khoản.', 'BankAccountNumber');
}
function readiness(profile, qrValid = false) {
  const missing = operationErrors(profile);
  if (bankFields.some(k => profile?.[k] != null && profile[k] !== '') && !bankDetails(profile)) missing.push('BankDetails');
  if (!bankDetails(profile) && !qrValid) missing.push('ReceivingMethod');
  return { ready: missing.length === 0, missing };
}
function availability(body) {
  object(body);
  if (Object.keys(body).length !== 1 || !['OFFLINE', 'AVAILABLE'].includes(body.AvailabilityStatus)) throw invalid('Chỉ được chuyển OFFLINE hoặc AVAILABLE; BUSY do nghiệp vụ chuyến quản lý.', 'AvailabilityStatus');
  return body.AvailabilityStatus;
}
module.exports = { patch, validateMerged, readiness, availability, operationErrors, limits };
