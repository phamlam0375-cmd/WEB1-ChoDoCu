'use strict'

const { Orders } = require('../models');

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

module.exports = { getSellerOrders }