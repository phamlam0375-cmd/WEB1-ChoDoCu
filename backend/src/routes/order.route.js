'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/authenticate');
const { withD01Demo } = require('../middlewares/auth.middleware');

// Cùng controller/contract cho hai prefix; chính sách auth được giữ riêng:
// Ngoài chế độ demo D01 opt-in: /api/orders chỉ JWT, /api/v1/orders dùng requireAuth.
function createOrderRouter(authMiddleware = authenticate) {
  const router = express.Router();
  const d01Auth = withD01Demo(authMiddleware);
  router.get('/preview/:listingId', d01Auth, orderController.getOrderPreview);
  router.post('/', d01Auth, orderController.createOrder);
  return router;
}

module.exports = createOrderRouter();
module.exports.createOrderRouter = createOrderRouter;
