'use strict';
const router = require('express').Router();
const { requireTokenAuth } = require('../../middlewares/auth.middleware');
const { HttpError } = require('../../utils/httpError');
const c = require('../../controllers/D10_ThatBai_HoanTra/failure.controller');
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
router.get('/deliveries/:deliveryId/failure-preview', noStore, requireTokenAuth, c.preview);
router.patch('/deliveries/:deliveryId/failure', noStore, requireTokenAuth, c.update('failure'));
router.patch('/deliveries/:deliveryId/return', noStore, requireTokenAuth, c.update('return'));
router.use(['/deliveries/:deliveryId/failure-preview', '/deliveries/:deliveryId/failure', '/deliveries/:deliveryId/return'], (e, _req, _res, next) => {
  if (e instanceof HttpError) return next(e);
  console.error('D10 internal failure:', e.original?.code || e.parent?.code || e.name || 'UNKNOWN');
  next(new HttpError(500, 'Không xử lý được D10. Hãy tải lại để kiểm tra kết quả trước khi thử tiếp.', null, 'D10_INTERNAL_ERROR'));
});
module.exports = router;
