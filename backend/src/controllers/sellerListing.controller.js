'use strict';

const { Listings, Store } = require("../models");

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
        const { sellerId } = req.params;
        if (!sellerId) {
            return res.status(404).json({
                success: false,
                message: "SellerId không hợp lệ"
            })
        }

        const seller = await Store.findOne({
            where: {
                OwnerId: sellerId
            }
        })
        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy seller"
            })
        }

        const listings = await Listings.findAll({
            where: {
                SellerId: sellerId
            }
        });

        return res.status(200).json({
            success: true,
            message: "Lấy sản phẩm thành công ",
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