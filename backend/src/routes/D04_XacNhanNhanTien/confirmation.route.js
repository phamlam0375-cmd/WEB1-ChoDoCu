'use strict';
const router = require('express').Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D04_XacNhanNhanTien/confirmation.controller');
// Không dùng marker demo người mua D01 cho API người bán. JWT hoặc tài khoản
// dev được chọn rõ ràng theo auth hiện có; production không nhận x-user-id.
router.get('/payments', requireAuth, controller.list);
router.get('/:id/payment', requireAuth, controller.detail);
router.patch('/:id/payment', requireAuth, controller.decide);
module.exports = router;
