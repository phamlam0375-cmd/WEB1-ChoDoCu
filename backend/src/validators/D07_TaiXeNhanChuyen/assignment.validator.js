'use strict';
const { HttpError } = require('../../utils/httpError');
const invalid = message => new HttpError(400, message, null, 'VALIDATION_ERROR');
function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295) throw invalid('Mã chuyến không hợp lệ.');
  return Number(value);
}
function list(query = {}) {
  if (Object.keys(query).some(k => !['page', 'limit', 'pickupArea', 'deliveryArea', 'vehicleType', 'sort'].includes(k))) throw invalid('Bộ lọc không được hỗ trợ.');
  const integer = (name, fallback, max) => {
    const value = query[name] ?? fallback;
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) throw invalid(`${name} không hợp lệ.`);
    return Number(value);
  };
  const result = { page: integer('page', 1, 1000000), limit: integer('limit', 20, 50), sort: query.sort ?? 'oldest' };
  if (!['oldest', 'newest'].includes(result.sort)) throw invalid('Thứ tự không hợp lệ.');
  for (const key of ['pickupArea', 'deliveryArea', 'vehicleType']) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== 'string' || !query[key].trim() || query[key].length > (key === 'vehicleType' ? 30 : 100) || /[\x00-\x1f\x7f]/.test(query[key])) throw invalid('Khu vực/phương tiện không hợp lệ.');
      result[key] = query[key].trim();
    }
  }
  result.offset = (result.page - 1) * result.limit;
  return result;
}
function accept(body) {
  if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) throw invalid('Nhận chuyến không nhận DriverId, địa chỉ, phí hoặc trạng thái từ client.');
}
module.exports = { id, list, accept };
