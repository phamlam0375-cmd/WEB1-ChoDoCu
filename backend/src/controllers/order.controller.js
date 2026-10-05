'use strict';

const orderService = require('../services/order.service');

async function getOrderPreview(request, response, next) {
  try {
    const data = await orderService.getOrderPreview(
      request.params.listingId,
      request.user.userId
    );
    response.json({
      success: true,
      message: 'Lấy thông tin đặt hàng thành công.',
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createOrder(request, response, next) {
  try {
    const result = await orderService.createOrder(request.body, request.user.userId);
    response.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = { createOrder, getOrderPreview };
