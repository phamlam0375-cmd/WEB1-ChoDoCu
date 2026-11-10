'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
const controller = require('../../controllers/D09_CapNhatTienDoGiaoHang/progress.controller');
router.patch('/deliveries/:deliveryId/status', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requireTokenAuth, controller.update);
router.use('/deliveries/:deliveryId/status', (e, _req, _res, next) => {
  if (e instanceof HttpError) return next(e);
  console.error('D09 internal failure:', e.original?.code || e.parent?.code || e.name || 'UNKNOWN');
  next(new HttpError(500, 'Không xử lý được tiến độ. Hãy tải lại để kiểm tra kết quả trước khi thử tiếp.', null, 'PROGRESS_INTERNAL_ERROR'));
});
module.exports = router;
