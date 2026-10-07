'use strict';

const orderService = require('../services/order.service');

async function getOrderPreview(req, res) {
  const data = await orderService.getOrderPreview(req.params.listingId, req.user);
  return res.status(200).json({
    success: true,
    message: 'Lấy thông tin đặt hàng thành công.',
    data
  });
}

async function createOrder(req, res) {
  const result = await orderService.createOrder(req.body, req.user.UserId);
  return res.status(201).json({ success: true, ...result });
}

module.exports = { createOrder, getOrderPreview };
