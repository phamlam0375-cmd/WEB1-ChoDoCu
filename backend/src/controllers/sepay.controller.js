'use strict';

const sepayService = require('../services/sepay.service');

const createCheckout = async (req, res) => {
  const data = await sepayService.createCheckout(req.user.UserId, Number(req.body.packageId));
  return res.status(201).json({ success: true, data });
};

const syncCheckout = async (req, res) => {
  const data = await sepayService.syncCheckout(req.user.UserId, req.params.invoice);
  return res.json({ success: true, data });
};

const handleIpn = async (req, res) => {
  const data = await sepayService.handleIpn(req.body);
  return res.json({ success: true, data });
};

module.exports = { createCheckout, syncCheckout, handleIpn };
