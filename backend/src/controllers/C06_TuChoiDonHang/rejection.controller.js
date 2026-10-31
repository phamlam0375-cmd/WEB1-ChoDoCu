'use strict';

const service = require('../../services/C06_TuChoiDonHang/rejection.service');

async function reject(req, res) {
  return res.status(200).json({ success: true, ...await service.rejectOrder(req.params.id, req.body, req.user) });
}

module.exports = { reject };
