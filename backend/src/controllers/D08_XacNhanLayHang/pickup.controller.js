'use strict';
const service = require('../../services/D08_XacNhanLayHang/pickup.service');
exports.driverPreview = async (req, res) => res.json({ success: true, data: await service.getDriverPreview(req.params.deliveryId, req.user) });
exports.sellerPreview = async (req, res) => res.json({ success: true, data: await service.getSellerPreview(req.params.orderId, req.user) });
exports.issue = async (req, res) => res.json({ success: true, ...await service.issueCode(req.params.orderId, req.body, req.user) });
exports.confirm = async (req, res) => {
  const body = { ...req.body };
  if (req.is('multipart/form-data') && body.packageIntact === 'true') body.packageIntact = true;
  res.json({ success: true, ...await service.confirm(req.params.deliveryId, body, req.file, req.user) });
};
exports.proof = async (req, res, next) => {
  const file = await service.getProof(req.params.orderId, req.params.deliveryId, req.user);
  // Chỉ target được server quản lý và đã kiểm tra quyền mới được đọc dot-directory.
  res.type(file.mime).sendFile(file.target, { dotfiles: 'allow', headers: { 'Cache-Control': 'no-store' } }, err => {
    if (!err) return;
    if (err.code === 'ENOENT' || err.status === 404) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh bằng chứng.' });
    next(err);
  });
};
