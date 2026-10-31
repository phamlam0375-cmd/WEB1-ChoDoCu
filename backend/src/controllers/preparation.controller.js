'use strict'

const { Orders, Deliveries, Listings } = require('../models');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { string } = require('zod');

const createDelivery = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const sellerId = req.user.UserId;

        const order = await Orders.findOne({
            where: { OrderId: orderId }
        })
        if (!order)
            return res.status(404).json({
                success: false,
                message: "không tìm thấy đơn hàng",
            });

        if (order.SellerId !== sellerId)
            return res.status(400).json({
                success: false,
                message: "Bạn không phải người bán",
            });

        const exsited = await Deliveries.findOne({
            where: { OrderId: orderId }
        })
        if (exsited)
            return res.status(409).json({
                success: false,
                message: "Đơn hàng này đã đóng gói ",
            });

        const listing = await Listings.findByPk(order.ListingId);
        if (!listing || !listing.Location)
            return res.status(400).json({
                success: false,
                message: "Không có địa chỉ lấy hàng",
            });
        const { pickupAdress } = listing.Location;

        const pickupCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const pickupCodeHash = await bcrypt.hash(pickupCode, 10);

        const delivery = await Deliveries.create({
            OrderId: orderId,
            PickupAddress: pickupAdress,
            DeliveryAddress: order.ReceiverAddress,
            DriverFee: order.DeliveryFee,
            PickupCodeHash: pickupCodeHash,
            Status: 'AVAILABLE'
        })

        return res.status(201).json({
            success: true,
            data: delivery,
            message: "Tạo delivery thành công"
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi server, ", error,
        });
    }
}

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