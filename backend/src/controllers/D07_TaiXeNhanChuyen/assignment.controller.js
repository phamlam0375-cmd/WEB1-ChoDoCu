'use strict';
const service = require('../../services/D07_TaiXeNhanChuyen/assignment.service');
exports.status = async (req, res) => res.json({ success: true, data: await service.status(req.user) });
exports.available = async (req, res) => res.json({ success: true, ...await service.available(req.query, req.user) });
exports.accept = async (req, res) => {
  const data = await service.accept(req.params.deliveryId, req.body, req.user);
  res.json({ success: true, message: `Đã nhận chuyến #${data.deliveryId}.`, data });
};
