'use strict'

const { Orders, Deliveries } = require('../models');
const bcrypt = require('bcrypt');
const { HttpError } = require('../utils/httpError');

const createDelivery = async (req, res) => {
    try {
        // C07 dùng transaction chung D07/D12; mã bàn giao do D08 quản lý sau khi nhận chuyến.
        const delivery = await require('../services/D12_UocTinhPhiGiaoHang/preparation.service').prepare(req.params.id, req.body, req.user);
        return res.status(201).json({ success: true, data: delivery, message: 'Đã xác nhận chuẩn bị hàng và tạo chuyến theo phí đã chốt.' });
    } catch (error) {
        if (error instanceof HttpError) throw error;
        console.error('C07 preparation failure:', error.original?.code || error.code || error.name);
        throw new HttpError(500, 'Không thể xác nhận chuẩn bị hàng.', null, 'PREPARATION_FAILED');
    }
};

const patchPickupOrder = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const sellerId = req.user.UserId;
        const pickupcode = req.body;

        if (!pickupcode)
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập mã lấy hàng",
            });

        const order = await Orders.findOne({
            where: { OrderId: orderId }
        })
        if (!order)
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng",
            });

        if (order.SellerId !== sellerId)
            return res.status(403).json({
                success: false,
                message: "Bạn không phải người bán",
            });

        const delivery = await Deliveries.findOne({
            where: { OrderId: orderId }
        })
        if (!delivery)
            return res.status(404).json({
                success: false,
                message: "Đơn hàng chưa được đóng gói",
            });

        if (delivery.Status === 'AVAILABLE')
            return res.status(409).json({
                success: false,
                message: "Chưa có tài xế nhận chuyến",
            });

        if (delivery.Status !== 'ACCEPTED' || !delivery.DriverId)
            return res.status(409).json({
                success: false,
                message: "Đơn đã bàn giao hoặc trạng thái không hợp lệ",
            });

        const isMatch = await bcrypt.compare(String(pickupcode), delivery.PickupCodeHash);
        if (!isMatch)
            return res.status(400).json({
                success: false,
                message: "Mã lấy hàng không đúng",
            });

        await delivery.update(
            { Status: 'PICKED_UP', PickedUpAt: new Date() }
        )
        await order.update(
            { Status: 'SHIPPING' }
        )

        return res.status(200).json({
            success: true,
            data: { deliveryId: delivery.DeliveryId, status: delivery.Status },
            message: "Bàn giao thành công",
        });

    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi server, ", error,
        });
    }
}

module.exports = { createDelivery, patchPickupOrder };
