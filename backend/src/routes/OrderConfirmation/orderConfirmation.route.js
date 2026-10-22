'use strict';

const express = require('express');
const { requireAuth, withD01Demo } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/OrderConfirmation/orderConfirmation.controller');

const router = express.Router();
router.patch('/:id/confirm', withD01Demo(requireAuth), controller.confirm);

module.exports = router;
