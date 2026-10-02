'use strict';

const AppError = require('../errors/AppError');

// D12 chưa có trong repository. Adapter này là điểm tích hợp duy nhất để D12
// cung cấp việc xác thực quote ở backend mà không làm D01 tin số tiền từ client.
function getCapability() {
  return {
    available: false,
    estimateEndpoint: '/api/delivery-fees/estimate',
    message: 'Dịch vụ ước tính phí giao hàng chưa sẵn sàng.'
  };
}

async function verifyQuote() {
  throw new AppError(
    503,
    'DELIVERY_SERVICE_UNAVAILABLE',
    'Dịch vụ ước tính phí giao hàng chưa sẵn sàng; hãy chọn tự đến lấy.'
  );
}

module.exports = { getCapability, verifyQuote };
