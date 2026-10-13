'use strict';
const router = require('express').Router();
const { requireAuth, withD01Demo } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/D05_TheoDoiDonHang/tracking.controller');
// Opt-in demo buyer chỉ được hai API đọc này; không mở /me/admin/refund/seller.
router.get('/', withD01Demo(requireAuth), controller.list);
router.get('/:id/tracking', withD01Demo(requireAuth), controller.detail);
module.exports = router;
