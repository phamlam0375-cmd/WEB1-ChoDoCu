'use strict';
const service = require('../../services/D05_TheoDoiDonHang/tracking.service');
const { HttpError } = require('../../utils/httpError');
const list = async (req, res) => { res.set('Cache-Control', 'no-store'); return res.json({ success: true, ...await service.listOrders(req.query, req.user) }); };
const detail = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const data = await service.getTracking(req.params.id, req.query, req.user);
  // D07 chỉ mở dữ liệu giao nhận cho driver bằng JWT đã được middleware xác thực.
  // Giữ cơ chế buyer/seller hiện có, nhưng không giả danh driver bằng header dev.
  if (data.viewer.role === 'DRIVER' && !req.get('authorization')) throw new HttpError(401, 'Tài xế cần đăng nhập thật để xem chuyến được phân công.', null, 'UNAUTHORIZED');
  return res.json({ success: true, data });
};
module.exports = { list, detail };
