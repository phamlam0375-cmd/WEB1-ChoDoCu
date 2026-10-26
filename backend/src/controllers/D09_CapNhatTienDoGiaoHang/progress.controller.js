'use strict';
const service = require('../../services/D09_CapNhatTienDoGiaoHang/progress.service');
exports.update = async (req, res) => res.json({ success: true, ...await service.update(req.params.deliveryId, req.body, req.get('Idempotency-Key'), req.user) });
