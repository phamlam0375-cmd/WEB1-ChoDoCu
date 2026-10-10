'use strict';

const express = require('express');
const { requireAuth, withD01Demo } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D02_HuyDonHang/cancellation.controller');

const router = express.Router();
// Dùng cùng danh tính demo D01, vẫn kiểm tra BuyerId tại service. Không mở router B/admin.
const orderAuth = withD01Demo(requireAuth);
router.get('/:id/cancellation-preview', orderAuth, controller.getPreview);
router.patch('/:id/cancel', orderAuth, controller.cancel);

module.exports = router;
