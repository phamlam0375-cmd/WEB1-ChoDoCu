'use strict';

const { success } = require("zod");
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
            success: false,
            message: "Lỗi tạo không thành công",
        });
    }
}

const getAllListing = async (req, res) => {
    try {
        const { storeId } = req.params;
        if (!storeId) {
            return res.status(404).json({
                success: false,
                message: "StoreId không hợp lệ"
            })
        }

        const store = await Store.findAll({
            where: {
                StoreId: storeId
            }
        })
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy store"
            })
        }

        const listings = await Listings.findAll({
            where: {
                StoreId: storeId
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
            success: false,
            message: "Lỗi lấy dữ liệu sản phẩm không thành công",
        });
    }
}

const getListingId = async (req, res) => {
    try {
        const { listingId } = req.params;
        const listing = await Listings.findOne({
            where: {
                ListingId: listingId
            }
        });

        if (!listing) {
            return res.status(500).json({
                message: "Lỗi không thấy sản phẩm",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy sản phẩm thành công ",
            data: listing
        })
    }
    catch (error) {
        return res.status(404).json({
            success: false,
            message: "Lỗi lấy dữ liệu sản phẩm không thành công",
        });
    }
}

module.exports = { createListing, getAllListing, getListingId };