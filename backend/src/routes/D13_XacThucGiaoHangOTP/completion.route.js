'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
const { MAX_BYTES } = require('../../controllers/uploads.controller');
const c = require('../../controllers/D13_XacThucGiaoHangOTP/completion.controller');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 3, fieldSize: 128, parts: 4 } }).single('proof');
const noStore = (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };
function parse(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  upload(req, res, e => {
    if (e) return next(new HttpError(e.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'Chỉ gửi mã, phiên mã, xác nhận và một ảnh JPG/PNG tối đa 5 MB.', null, 'INVALID_COMPLETION_PROOF'));
    if (req.body.handoverConfirmed === 'true') req.body.handoverConfirmed = true;
    else if (req.body.handoverConfirmed === 'false') req.body.handoverConfirmed = false;
    next();
  });
}
router.get('/orders/:orderId/delivery-code', noStore, requireTokenAuth, c.buyerPreview);
router.post('/orders/:orderId/delivery-code', noStore, requireTokenAuth, c.issue);
router.get('/driver/deliveries/:deliveryId/complete-preview', noStore, requireTokenAuth, c.driverPreview);
// Quyền và trạng thái được kiểm tra trước khi nhận/decode upload, rồi kiểm tra lại trong transaction.
router.patch('/driver/deliveries/:deliveryId/complete', noStore, requireTokenAuth, c.authorizeUpload, parse, c.complete);
router.get('/orders/:orderId/deliveries/:deliveryId/completion-proof', noStore, requireTokenAuth, c.proof);
router.use((e, _req, res, next) => {
  if (e instanceof HttpError) {
    if (e.status === 429 && e.errors?.retryAfterSeconds) res.set('Retry-After', String(e.errors.retryAfterSeconds));
    return next(e);
  }
  console.error('D13 internal failure:', e.original?.code || e.parent?.code || e.code || e.name || 'UNKNOWN');
  next(new HttpError(500, 'Không xử lý được xác thực giao hàng. Hãy tải lại để kiểm tra trạng thái đã lưu.', null, 'COMPLETION_INTERNAL_ERROR'));
});
module.exports = router;
