'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D05_TheoDoiDonHang/tracking.controller');
// Read the authenticated account only; no demo identity.
router.get('/', requireTokenAuth, controller.list);
router.get('/:id/tracking', requireTokenAuth, controller.detail);
module.exports = router;
