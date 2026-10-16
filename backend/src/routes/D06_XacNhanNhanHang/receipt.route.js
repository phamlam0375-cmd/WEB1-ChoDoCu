'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D06_XacNhanNhanHang/receipt.controller');
router.get('/:id/received-preview', requireTokenAuth, controller.preview);
router.patch('/:id/received', requireTokenAuth, controller.confirm);
module.exports = router;
