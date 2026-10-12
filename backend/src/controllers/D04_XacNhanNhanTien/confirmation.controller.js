'use strict';
const service = require('../../services/D04_XacNhanNhanTien/confirmation.service');

const list = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, ...await service.listPayments(req.query, req.user) });
};
const detail = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, data: await service.getDetail(req.params.id, req.user) });
};
const decide = async (req, res) => res.status(200).json({ success: true, ...await service.decide(req.params.id, req.body, req.user) });
module.exports = { list, detail, decide };
