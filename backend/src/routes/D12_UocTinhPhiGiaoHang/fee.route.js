'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
router.post('/estimate', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requireTokenAuth, require('../../controllers/D12_UocTinhPhiGiaoHang/fee.controller').estimate);
router.use((error, _req, _res, next) => {
  if (error instanceof HttpError) return next(error);
  console.error('D12 failure:', error.original?.code || error.code || error.name || 'UNKNOWN');
  next(new HttpError(500, 'Không thể tính phí giao hàng. Vui lòng thử lại.', null, 'DELIVERY_ESTIMATE_FAILED'));
});
module.exports = router;
