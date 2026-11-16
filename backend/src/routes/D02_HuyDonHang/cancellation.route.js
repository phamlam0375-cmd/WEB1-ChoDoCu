'use strict';

const express = require('express');
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D02_HuyDonHang/cancellation.controller');

const router = express.Router();
// Real JWT plus server-side ownership; no dev/demo identity.
const orderAuth = requireTokenAuth;
router.get('/:id/cancellation-preview', orderAuth, controller.getPreview);
router.patch('/:id/cancel', orderAuth, controller.cancel);

module.exports = router;
