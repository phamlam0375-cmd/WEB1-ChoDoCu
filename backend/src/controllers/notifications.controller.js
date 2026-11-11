'use strict';

const { Notifications } = require('../models');
const { badRequest, notFound } = require('../utils/httpError');

const listNotifications = async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const notifications = await Notifications.findAll({
    where: { UserId: req.user.UserId },
    order: [['CreatedAt', 'DESC']],
    limit,
  });
  const unreadCount = await Notifications.count({
    where: { UserId: req.user.UserId, IsRead: false },
  });
  return res.json({ success: true, data: { notifications, unreadCount } });
};

const markNotificationRead = async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    throw badRequest('Mã thông báo không hợp lệ.');
  }
  const [updated] = await Notifications.update(
    { IsRead: true },
    { where: { NotificationId: notificationId, UserId: req.user.UserId } },
  );
  if (!updated) throw notFound('Không tìm thấy thông báo.');
  return res.json({ success: true });
};

const markAllNotificationsRead = async (req, res) => {
  await Notifications.update(
    { IsRead: true },
    { where: { UserId: req.user.UserId, IsRead: false } },
  );
  return res.json({ success: true });
};

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };
