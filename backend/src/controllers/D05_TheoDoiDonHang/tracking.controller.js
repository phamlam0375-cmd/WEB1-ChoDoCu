'use strict';
const service = require('../../services/D05_TheoDoiDonHang/tracking.service');
const list = async (req, res) => { res.set('Cache-Control', 'no-store'); return res.json({ success: true, ...await service.listOrders(req.query, req.user) }); };
const detail = async (req, res) => { res.set('Cache-Control', 'no-store'); return res.json({ success: true, data: await service.getTracking(req.params.id, req.query, req.user) }); };
module.exports = { list, detail };
