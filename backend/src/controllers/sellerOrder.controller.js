'use strict'

const { Orders } = require('../models');
const { updateSellerOrderStatusSchema } = require('../validators/sellerOrder.validator')

const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.UserId;
        const orders = await Orders.findAll({
            where: {
                SellerId: sellerId,
                Status: "RESERVED",
            },
            order: [["CreatedAt", "DESC"]]
        })
        return res.status(200).json({
            success: true,
            data: orders
        })
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const updateSellerOrderStatus = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const { status, reason } = req.body;

        const sellerId = req.user?.UserId;
        if (!sellerId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập.",
            });
        }
        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã đơn hàng không hợp lệ.",
            });
        }

        const validation = updateSellerOrderStatusSchema.safeParse(
            req.body
        );
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: validation.error.issues[0].message,
                errors: validation.error.issues,
            });
        }

        const order = await Orders.findOne({
            where: {
                OrderId: orderId,
                SellerId: sellerId,
                Status: "RESERVED",
            },
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy đơn hàng hoặc đơn hàng không còn chờ xử lý.",
            });
        }
        const nextStatus = ["CONFIRM", "CONFIRMED"].includes(status)
            ? "WAITING_PAYMENT"
            : "CANCELLED";
        await order.update({
            Status: nextStatus,
            CancelReason:
                status === "REJECTED" ? reason.trim() : null,
        });
        return res.status(200).json({
            success: true,
            message:
                ["CONFIRM", "CONFIRMED"].includes(status)
                    ? "Đã chấp nhận đơn hàng."
                    : "Đã từ chối đơn hàng.",
            data: order,
        });

    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports = { getSellerOrders, updateSellerOrderStatus }