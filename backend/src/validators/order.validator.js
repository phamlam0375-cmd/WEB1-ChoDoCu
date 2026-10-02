'use strict';

const { HttpError } = require('../utils/httpError');

const PHONE_PATTERN = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/;
const FORBIDDEN_FIELDS = [
  'buyerId', 'sellerId', 'productAmount', 'deliveryFee', 'totalAmount',
  'commissionRate', 'status', 'reservedUntil'
];

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validationError(fields) {
  return new HttpError(
    422,
    'Thông tin đặt hàng không hợp lệ.',
    { fields },
    'VALIDATION_ERROR'
  );
}

function validateCreateOrder(payload = {}) {
  const controlled = FORBIDDEN_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(payload, field)
  ));
  if (controlled.length) {
    throw validationError(Object.fromEntries(controlled.map((field) => [field, 'Trường này do máy chủ quyết định.'])));
  }

  const listingId = Number(payload.listingId);
  const deliveryMethod = trimmed(payload.deliveryMethod).toUpperCase();
  const receiverName = trimmed(payload.receiverName);
  const receiverPhone = trimmed(payload.receiverPhone).replace(/[.\s-]/g, '');
  const receiverAddress = trimmed(payload.receiverAddress);
  const note = trimmed(payload.note);
  const deliveryQuoteId = trimmed(payload.deliveryQuoteId);
  const fields = {};

  if (!Number.isSafeInteger(listingId) || listingId <= 0) fields.listingId = 'Mã sản phẩm không hợp lệ.';
  if (!['DELIVERY', 'PICKUP'].includes(deliveryMethod)) fields.deliveryMethod = 'Hình thức nhận hàng không hợp lệ.';
  if (!receiverName) fields.receiverName = 'Vui lòng nhập họ tên người nhận.';
  else if (receiverName.length > 100) fields.receiverName = 'Họ tên tối đa 100 ký tự.';
  if (!receiverPhone) fields.receiverPhone = 'Vui lòng nhập số điện thoại.';
  else if (!PHONE_PATTERN.test(receiverPhone)) fields.receiverPhone = 'Số điện thoại Việt Nam không hợp lệ.';
  if (deliveryMethod === 'DELIVERY' && !receiverAddress) fields.receiverAddress = 'Vui lòng nhập địa chỉ nhận hàng.';
  if (receiverAddress.length > 255) fields.receiverAddress = 'Địa chỉ tối đa 255 ký tự.';
  if (note.length > 500) fields.note = 'Ghi chú tối đa 500 ký tự.';
  if (deliveryMethod === 'DELIVERY' && !deliveryQuoteId) fields.deliveryQuoteId = 'Vui lòng tính phí giao hàng trước khi đặt.';

  if (Object.keys(fields).length) throw validationError(fields);
  return {
    listingId,
    deliveryMethod,
    receiverName,
    receiverPhone,
    receiverAddress: deliveryMethod === 'PICKUP' ? null : receiverAddress,
    note: note || null,
    deliveryQuoteId: deliveryMethod === 'PICKUP' ? null : deliveryQuoteId
  };
}

module.exports = { validateCreateOrder };
