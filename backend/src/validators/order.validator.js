'use strict';

const AppError = require('../errors/AppError');

const PHONE_PATTERN = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/;
const FORBIDDEN_FIELDS = [
  'buyerId',
  'sellerId',
  'productAmount',
  'deliveryFee',
  'totalAmount',
  'commissionRate',
  'status',
  'reservedUntil'
];

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validationError(details) {
  return new AppError(
    422,
    'VALIDATION_ERROR',
    'Thông tin đặt hàng không hợp lệ.',
    details
  );
}

function validateCreateOrder(payload = {}) {
  const invalidControlledFields = FORBIDDEN_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(payload, field)
  ));
  if (invalidControlledFields.length > 0) {
    throw validationError({
      fields: invalidControlledFields,
      message: 'Các trường này do máy chủ quyết định.'
    });
  }

  const listingId = Number(payload.listingId);
  const deliveryMethod = trimmedString(payload.deliveryMethod).toUpperCase();
  const receiverName = trimmedString(payload.receiverName);
  const receiverPhone = trimmedString(payload.receiverPhone).replace(/[.\s-]/g, '');
  const receiverAddress = trimmedString(payload.receiverAddress);
  const note = trimmedString(payload.note);
  const deliveryQuoteId = trimmedString(payload.deliveryQuoteId);
  const fields = {};

  if (!Number.isSafeInteger(listingId) || listingId <= 0) {
    fields.listingId = 'Mã sản phẩm không hợp lệ.';
  }
  if (!['DELIVERY', 'PICKUP'].includes(deliveryMethod)) {
    fields.deliveryMethod = 'Hình thức nhận hàng không hợp lệ.';
  }
  if (!receiverName) fields.receiverName = 'Vui lòng nhập họ tên người nhận.';
  if (receiverName.length > 100) fields.receiverName = 'Họ tên tối đa 100 ký tự.';
  if (!receiverPhone) fields.receiverPhone = 'Vui lòng nhập số điện thoại.';
  else if (!PHONE_PATTERN.test(receiverPhone)) {
    fields.receiverPhone = 'Số điện thoại Việt Nam không hợp lệ.';
  }
  if (deliveryMethod === 'DELIVERY' && !receiverAddress) {
    fields.receiverAddress = 'Vui lòng nhập địa chỉ nhận hàng.';
  }
  if (receiverAddress.length > 255) fields.receiverAddress = 'Địa chỉ tối đa 255 ký tự.';
  if (note.length > 500) fields.note = 'Ghi chú tối đa 500 ký tự.';
  if (deliveryMethod === 'DELIVERY' && !deliveryQuoteId) {
    fields.deliveryQuoteId = 'Vui lòng tính phí giao hàng trước khi đặt.';
  }

  if (Object.keys(fields).length > 0) throw validationError({ fields });

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
