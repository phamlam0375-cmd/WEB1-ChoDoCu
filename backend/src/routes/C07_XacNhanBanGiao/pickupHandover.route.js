'use strict';

const express = require('express');
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const controller = require('../../controllers/C07_XacNhanBanGiao/pickupHandover.controller');

const router = express.Router();
router.post('/:id/pickup-handover', requireTokenAuth, controller.confirm);

module.exports = router;
