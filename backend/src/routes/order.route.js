'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/authenticate');

// Cùng controller/contract cho hai prefix; chính sách auth được giữ riêng:
// /api/orders chỉ JWT, /api/v1/orders dùng requireAuth của phân hệ dùng chung.
function createOrderRouter(authMiddleware = authenticate) {
  const router = express.Router();
  router.get('/preview/:listingId', authMiddleware, orderController.getOrderPreview);
  router.post('/', authMiddleware, orderController.createOrder);
  return router;
}

module.exports = createOrderRouter();
module.exports.createOrderRouter = createOrderRouter;
