'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/preview/:listingId', authenticate, orderController.getOrderPreview);
router.post('/', authenticate, orderController.createOrder);

module.exports = router;
