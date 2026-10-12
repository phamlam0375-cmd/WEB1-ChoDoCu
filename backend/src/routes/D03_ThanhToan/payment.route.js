'use strict';
const express = require('express');
const multer = require('multer');
const controller = require('../../controllers/D03_ThanhToan/payment.controller');
const { requireAuth, withD01Demo } = require('../../middlewares/auth.middleware');
const { MAX_BYTES, INVALID_IMAGE_MESSAGE } = require('../../controllers/uploads.controller');
const { HttpError } = require('../../utils/httpError');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 1, fieldSize: 100, parts: 2 } }).single('proof');
const proofUpload = (req, res, next) => upload(req, res, error => {
  if (!error) return next();
  return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? INVALID_IMAGE_MESSAGE : 'Chỉ gửi một ảnh biên lai và số tiền hợp lệ.', null, 'INVALID_PROOF'));
});

router.get('/:id/payment-info', withD01Demo(requireAuth), controller.getPaymentInfo);
router.post('/:id/payment-notice', withD01Demo(requireAuth), proofUpload, controller.reportPayment);
module.exports = router;
