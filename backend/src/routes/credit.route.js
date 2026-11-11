'use strict';

const express = require('express');
const creditController = require('../controllers/credit.controller');
const sepayController = require('../controllers/sepay.controller');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/packaged', creditController.getPackaged);
router.get('/balance', authenticate, creditController.getBalance);
router.post('/deposits', authenticate, creditController.createDeposit);
router.post('/sepay/checkout', authenticate, sepayController.createCheckout);
router.get('/sepay/status/:invoice', authenticate, sepayController.syncCheckout);
router.post('/sepay/ipn', sepayController.handleIpn);

module.exports = router;