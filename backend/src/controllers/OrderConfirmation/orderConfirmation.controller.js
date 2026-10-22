'use strict';

const service = require('../../services/OrderConfirmation/orderConfirmation.service');

async function confirm(req, res) {
  return res.status(200).json({ success: true, ...await service.confirmOrder(req.params.id, req.body, req.user) });
}

module.exports = { confirm };
