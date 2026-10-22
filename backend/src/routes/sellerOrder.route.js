const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

const { getSellerOrders, updateSellerOrderStatus } = require('../controllers/sellerOrder.controller');
router.get('/', requireAuth, getSellerOrders);
router.patch('/:orderId/status', requireAuth, updateSellerOrderStatus);

module.exports = router;