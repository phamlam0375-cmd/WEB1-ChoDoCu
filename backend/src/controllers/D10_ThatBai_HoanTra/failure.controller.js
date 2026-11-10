'use strict';
const service = require('../../services/D10_ThatBai_HoanTra/failure.service');
exports.preview = async (req, res) => {
  const data = await service.getPreview(req.params.deliveryId, req.user);
  res.set('ETag', data.version).json({ success: true, data });
};
exports.update = route => async (req, res) => {
  const result = await service.update(req.params.deliveryId, req.body, req.get('Idempotency-Key'), req.get('If-Match'), route, req.user);
  res.set('ETag', result.data.version).json({ success: true, ...result });
};
