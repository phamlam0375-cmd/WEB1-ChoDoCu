'use strict';
const { HttpError } = require('../../utils/httpError');
const { validateOrderId } = require('../D03_ThanhToan/payment.validator');
const { parsePagination } = require('../../utils/request');
const STATUSES = ['RESERVED', 'WAITING_PAYMENT', 'PAID', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'];
const invalid = () => new HttpError(400, 'Bộ lọc, phân trang hoặc sắp xếp không hợp lệ.', null, 'VALIDATION_ERROR');
function pagination(query, pageKey = 'page', limitKey = 'limit') {
  for (const key of [pageKey, limitKey]) {
    if (query[key] !== undefined && (typeof query[key] !== 'string' || !/^\d+$/.test(query[key]) || !Number.isSafeInteger(Number(query[key])) || Number(query[key]) < 1)) throw invalid();
  }
  const result = parsePagination({ page: query[pageKey], limit: query[limitKey] });
  if (!Number.isSafeInteger(result.offset)) throw invalid();
  return result;
}
function validateList(query = {}) {
  if (Object.keys(query).some(key => !['page', 'limit', 'status', 'sort'].includes(key))) throw invalid();
  const status = query.status || '', sort = query.sort || 'newest';
  if ((status && !STATUSES.includes(status)) || !['newest', 'oldest'].includes(sort)) throw invalid();
  return { ...pagination(query), status, sort };
}
function validateTracking(query = {}) {
  if (Object.keys(query).some(key => !['historyPage', 'historyLimit'].includes(key))) throw invalid();
  return pagination(query, 'historyPage', 'historyLimit');
}
module.exports = { validateOrderId, validateList, validateTracking, STATUSES };
