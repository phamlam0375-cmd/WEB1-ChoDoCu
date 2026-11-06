'use strict';
const service = require('../../services/D11_HoSoVanHanhTaiXe/profile.service');
exports.get = async (req, res) => res.json({ success: true, data: await service.get(req.user) });
exports.patch = async (req, res) => res.json({ success: true, message: 'Đã cập nhật hồ sơ vận hành.', data: await service.patch(req.profileBody ?? req.body, req.file, req.user) });
exports.availability = async (req, res) => res.json({ success: true, message: 'Đã cập nhật hồ sơ và trạng thái tài xế.', data: await service.availability(req.body, req.user) });
exports.qr = async (req, res, next) => {
  const file = await service.qr(req.params.key, req.user);
  // File nằm trong dot-directory để static uploads không phục vụ; route này đã kiểm tra chính chủ.
  res.type(file.mime).sendFile(file.target, { dotfiles: 'allow', cacheControl: false }, error => {
    if (error) next(error.status === 404 ? new (require('../../utils/httpError').HttpError)(404, 'Không tìm thấy QR nhận phí.', null, 'QR_NOT_FOUND') : error);
  });
};
