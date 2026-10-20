'use strict';

const express = require('express');
const { requireAuth, withD01Demo } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/C06_TuChoiDonHang/rejection.controller');

const router = express.Router();
router.patch('/:id/reject', withD01Demo(requireAuth), controller.reject);

module.exports = router;
