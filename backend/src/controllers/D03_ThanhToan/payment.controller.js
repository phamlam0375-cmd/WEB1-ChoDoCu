'use strict';
const service = require('../../services/D03_ThanhToan/payment.service');

const getPaymentInfo = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await service.getPaymentInfo(req.params.id, req.user) });
};
const reportPayment = async (req, res) => res.json({ success: true, ...await service.reportPayment(req.params.id, req.body, req.file, req.user) });

module.exports = { getPaymentInfo, reportPayment };
