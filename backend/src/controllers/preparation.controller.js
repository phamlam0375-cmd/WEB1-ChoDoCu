'use strict'

const { Orders, Deliveries, Listings } = require('../models');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

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
        if (!listing.Location || !listing)
            return res.status(400).json({
                success: false,
                message: "Không có địa chỉ lấy hàng",
            });
        const pickupAdress = listing.Location;

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

module.exports = { createDelivery };