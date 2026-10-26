'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
const { MAX_BYTES } = require('../../controllers/uploads.controller');
const { INVALID_IMAGE } = require('../../validators/D08_XacNhanLayHang/pickup.validator');
const c = require('../../controllers/D08_XacNhanLayHang/pickup.controller');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 2, fieldSize: 100, parts: 3 } }).single('proof');
const parseProof = (req, res, next) => upload(req, res, e => next(e ? new HttpError(e.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
  e.code === 'LIMIT_FILE_SIZE' ? INVALID_IMAGE : 'Chỉ gửi mã, xác nhận kiện và tối đa một ảnh.', null, 'INVALID_PROOF') : undefined));
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
// Chỉ gắn auth vào các route D08, không router.use(auth) trên toàn /api/v1.
router.get('/driver/deliveries/:deliveryId/pickup-preview', noStore, requireTokenAuth, c.driverPreview);
router.patch('/driver/deliveries/:deliveryId/pickup', noStore, requireTokenAuth, parseProof, c.confirm);
router.get('/seller/orders/:orderId/pickup-code', noStore, requireTokenAuth, c.sellerPreview);
router.post('/seller/orders/:orderId/pickup-code', noStore, requireTokenAuth, c.issue);
router.get('/orders/:orderId/deliveries/:deliveryId/pickup-proof', noStore, requireTokenAuth, c.proof);
// Không gắn middleware lỗi global: chỉ thêm Retry-After cho lỗi D08 có thời gian chờ.
router.use((e, _req, res, next) => {
  if (e.status === 429 && e.errors?.retryAfterSeconds) res.set('Retry-After', String(e.errors.retryAfterSeconds));
  if (!(e instanceof HttpError)) {
    // Sequelize lỗi có thể chứa SQL/hash trong message. Không đẩy object đó ra logger chung.
    console.error('D08 internal failure:', e.original?.code || e.parent?.code || e.code || e.name || 'UNKNOWN');
    return next(new HttpError(500, 'Không xử lý được xác nhận lấy hàng. Vui lòng tải lại để kiểm tra trạng thái.', null, 'PICKUP_INTERNAL_ERROR'));
  }
  next(e);
});
module.exports = router;
