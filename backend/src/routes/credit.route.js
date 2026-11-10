'use strict';

const express = require('express');
const creditController = require('../controllers/credit.controller');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/packaged', creditController.getPackaged);
router.get('/balance', authenticate, creditController.getBalance);
router.post('/deposits', authenticate, creditController.createDeposit);

module.exports = router;