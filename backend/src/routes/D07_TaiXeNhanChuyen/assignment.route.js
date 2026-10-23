'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const c = require('../../controllers/D07_TaiXeNhanChuyen/assignment.controller');
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(requireTokenAuth); // Không x-user-id, không marker demo D01.
router.get('/status', c.status);
router.get('/deliveries/available', c.available);
router.patch('/deliveries/:deliveryId/accept', c.accept);
module.exports = router;
