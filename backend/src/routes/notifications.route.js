'use strict';

const express = require('express');
const notifications = require('../controllers/notifications.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', notifications.listNotifications);
router.patch('/read-all', notifications.markAllNotificationsRead);
router.patch('/:id/read', notifications.markNotificationRead);

module.exports = router;
