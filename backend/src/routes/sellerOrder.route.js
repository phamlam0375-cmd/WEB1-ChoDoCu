const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const router = express.Router();

const { getSellerOrders } = require('../controllers/sellerOrder.controller');
router.get('/', requireAuth, getSellerOrders);

module.exports = router;