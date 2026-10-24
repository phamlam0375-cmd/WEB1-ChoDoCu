'use strict';
const service = require('../../services/D06_XacNhanNhanHang/receipt.service');
const preview = async (req, res) => res.set('Cache-Control', 'no-store').json({ success: true, data: await service.getPreview(req.params.id, req.user) });
const confirm = async (req, res) => res.set('Cache-Control', 'no-store').json({ success: true, ...await service.confirmReceived(req.params.id, req.body, req.user) });
module.exports = { preview, confirm };
