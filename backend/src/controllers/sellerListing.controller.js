'use strict';

const { Listings } = require("../models");

const createListing = async (req, res) => {
    try {
        const {
            SellerId,
            StoreId,
            CategoryId,
            Title,
            Description,
            Price,
            ConditionLevel,
            KnownDefects,
            Location
        } = req.body;
        const listing = await Listings.create({
            SellerId,
            StoreId,
            CategoryId,
            Title,
            Description,
            Price,
            ConditionLevel,
            KnownDefects,
            Location
        });
        return res.status(201).json({
            success: true,
            message: "Tạo bài đăng thành công",
            data: listing
        })
    }
    catch (error) {
        return res.status(500).json({
            message: "Lỗi tạo không thành công",
        });
    }
}

const getAllListing = async (req, res) => {
    try {
        const listings = await Listings.findAll({
            where: {
                SellerId: req.params.sellerId
            }
        });
        return res.status(200).json({
            success: true,
            message: "Lấy sản phẩm thành công thành công",
            data: listings
        })
    }
    catch (error) {
        return res.status(500).json({
            message: "Lỗi lấy dữ liệu sản phẩm không thành công",
        });
    }
}

module.exports = { createListing, getAllListing };