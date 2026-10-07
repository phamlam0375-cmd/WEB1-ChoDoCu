'use strict';

const { HttpError } = require('../utils/httpError');

// D12 chưa có trong repository. Đây là điểm tích hợp duy nhất để D12 cung cấp
// việc xác thực báo giá ở backend; D01 không nhận số tiền do client tự gửi.
function getCapability() {
  return {
    available: false,
    estimateEndpoint: '/api/v1/delivery-fees/estimate',
    message: 'Dịch vụ ước tính phí giao hàng chưa sẵn sàng.'
  };
}

async function verifyQuote() {
  throw new HttpError(
    503,
    'Dịch vụ ước tính phí giao hàng chưa sẵn sàng; hãy chọn tự đến lấy.',
    null,
    'DELIVERY_SERVICE_UNAVAILABLE'
  );
}

module.exports = { getCapability, verifyQuote };
