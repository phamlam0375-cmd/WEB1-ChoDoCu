'use strict';

const service = require('../../services/D02_HuyDonHang/cancellation.service');

async function getPreview(req, res) {
  const data = await service.getCancellationPreview(req.params.id, req.user);
  return res.json({ success: true, data });
}

async function cancel(req, res) {
  const result = await service.cancelOrder(req.params.id, req.body, req.user);
  return res.json({ success: true, ...result });
}

module.exports = { getPreview, cancel };
