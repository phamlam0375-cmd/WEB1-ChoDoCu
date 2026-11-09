'use strict';

const service = require('./D12_UocTinhPhiGiaoHang/fee.service');
// Giữ import cũ của D01; chỉ một nguồn tính/xác thực báo giá.
function getCapability() {
  return {
    available: true,
    estimateEndpoint: '/api/v1/delivery-fees/estimate',
    message: 'Phí được xác nhận theo tuyến, phương tiện và báo giá còn hạn.'
  };
}

module.exports = { getCapability, getContext: service.context, verifyQuote: service.verifyQuote };
