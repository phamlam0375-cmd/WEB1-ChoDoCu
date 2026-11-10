'use strict';
const service = require('../../services/D12_UocTinhPhiGiaoHang/fee.service');
exports.estimate = async (req, res) => res.json({ success: true, message: 'Đã tính phí dự kiến; chưa tạo hoặc giữ sản phẩm.', data: await service.estimate(req.body, req.user) });
