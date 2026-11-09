'use strict';
const service = require('../../services/D13_XacThucGiaoHangOTP/completion.service');
const { HttpError } = require('../../utils/httpError');
exports.buyerPreview = async (req, res) => res.json({ success: true, data: await service.getBuyerPreview(req.params.orderId, req.user) });
exports.driverPreview = async (req, res) => res.json({ success: true, data: await service.getDriverPreview(req.params.deliveryId, req.user) });
exports.issue = async (req, res) => res.json({ success: true, ...await service.issueCode(req.params.orderId, req.body ?? {}, req.user) });
exports.authorizeUpload = async (req, _res, next) => { await service.authorizeUpload(req.params.deliveryId, req.get('Idempotency-Key'), req.user); next(); };
exports.complete = async (req, res) => res.json({ success: true, ...await service.complete(req.params.deliveryId, req.body ?? {}, req.file, req.get('Idempotency-Key'), req.user) });
exports.proof = async (req, res, next) => {
  const file = await service.getProof(req.params.orderId, req.params.deliveryId, req.user);
  res.type(file.mime).sendFile(file.target, { dotfiles: 'allow', cacheControl: false }, e => {
    if (e) next(e.status === 404 ? new HttpError(404, 'Không tìm thấy ảnh bàn giao.', null, 'COMPLETION_PROOF_NOT_FOUND') : e);
  });
};
