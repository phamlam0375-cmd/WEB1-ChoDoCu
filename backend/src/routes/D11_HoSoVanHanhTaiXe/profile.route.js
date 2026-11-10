'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
const { MAX_BYTES } = require('../../controllers/uploads.controller');
const c = require('../../controllers/D11_HoSoVanHanhTaiXe/profile.controller');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 1, fieldSize: 8192, parts: 2 } }).single('qr');
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
function parse(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  upload(req, res, error => {
    if (error) return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'Chỉ gửi hồ sơ và một ảnh QR JPG/PNG tối đa 5MB.', null, 'INVALID_QR'));
    try {
      if (Object.keys(req.body).some(k => k !== 'profile')) throw new Error();
      req.profileBody = JSON.parse(req.body.profile || '{}'); next();
    } catch { next(new HttpError(400, 'Trường profile phải là JSON hợp lệ.', null, 'PROFILE_VALIDATION')); }
  });
}
router.get('/profile', noStore, requireTokenAuth, c.get);
router.patch('/profile', noStore, requireTokenAuth, parse, c.patch);
router.patch('/availability', noStore, requireTokenAuth, c.availability);
router.get('/profile/qr/:key', noStore, requireTokenAuth, c.qr);
router.use((error, _req, _res, next) => {
  if (error instanceof HttpError) return next(error);
  // Không ghi SQL/bank/ảnh hoặc token vào log chung.
  console.error('D11 internal failure:', error.original?.code || error.code || error.name || 'UNKNOWN');
  next(new HttpError(500, 'Không xử lý được hồ sơ. Hãy tải lại để kiểm tra trạng thái.', null, 'PROFILE_INTERNAL_ERROR'));
});
module.exports = router;
