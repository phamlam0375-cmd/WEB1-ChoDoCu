'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D04_XacNhanNhanTien/confirmation.controller');
// Chỉ nhận JWT thật; quyền người bán và chủ đơn được kiểm tra tại service.
router.get('/payments', requireTokenAuth, controller.list);
router.get('/:id/payment', requireTokenAuth, controller.detail);
router.patch('/:id/payment', requireTokenAuth, controller.decide);
module.exports = router;
