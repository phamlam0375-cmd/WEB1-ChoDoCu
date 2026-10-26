'use strict';

const { Sequelize } = require("sequelize");
const { Listings, ListingMedia, Store } = require("../models");

const createListing = async (req, res) => {
    try {
        const {
            StoreId,
            CategoryId,
            Title,
            Description,
            Price,
            ConditionLevel,
            KnownDefects,
            Location
        } = req.body;
        const store = await Store.findOne({
            where: { StoreId, OwnerId: req.user.UserId },
        });
        if (!store) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền đăng sản phẩm cho cửa hàng này",
            });
        }
        const listing = await Listings.create({
            SellerId: req.user.UserId,
            StoreId,
            CategoryId,
            Title,
            Description,
            Price,
            ConditionLevel,
            KnownDefects,
            Location
        });

        // Lưu ảnh vào ListingMedia nếu có
        if (req.files && req.files.length > 0) {
            const mediaRecords = req.files.map((file, index) => ({
                ListingId: listing.ListingId,
                MediaType: "IMAGE",
                MediaUrl: `/api/v1/uploads/listings/${file.filename}`,
                SortOrder: index + 1,
            }));
            await ListingMedia.bulkCreate(mediaRecords);
        }

        // Trả về listing kèm media
        const result = await Listings.findOne({
            where: { ListingId: listing.ListingId },
            include: [{
                model: ListingMedia,
                as: "Media",
                attributes: ["MediaId", "MediaUrl", "MediaType", "SortOrder"],
                separate: true,
                order: [["SortOrder", "ASC"]],
            }],
        });

        return res.status(201).json({
            success: true,
            message: "Tạo bài đăng thành công",
            data: result
        })
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi tạo không thành công",
        });
    }
}

const getAllListingStore = async (req, res) => {
    try {
        const { StoreId } = req.params;
        if (!StoreId || !/^\d+$/.test(StoreId)) {
            return res.status(404).json({
                success: false,
                message: "StoreId không hợp lệ"
            })
        }

        const store = await Store.findByPk(StoreId);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy store"
            })
        }

        //paginate
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const { count, rows } = await Listings.findAndCountAll({
            where: { StoreId },
            include: [{
                model: ListingMedia,
                as: "Media",
                attributes: ["MediaId", "MediaUrl", "MediaType", "SortOrder"],
                separate: true,
                order: [["SortOrder", "ASC"]],
            }],
            order: [
                [Sequelize.literal("CASE WHEN Status = 'SOLD' THEN 1 ELSE 0 END"), "ASC"],
                ["createdAt", "ASC"],
            ],
            limit,
            offset: (page - 1) * limit
        });

        return res.status(200).json({
            success: true,
            message: "Lấy sản phẩm thành công ",
            data: rows,
            pagination: {
                page,
                limit,
                totalItems: count,
                totalPages: Math.ceil(count / limit)
            }
        })

    }
    catch (error) {
        console.log(error.message);

        return res.status(500).json({
            success: false,
            message: "Lỗi lấy dữ liệu sản phẩm không thành công",
        });
    }
}

const getListingId = async (req, res) => {
    try {
        const { ListingId } = req.params;
        const listing = await Listings.findOne({
            where: { ListingId }
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

const deleteListing = async (req, res) => {
    try {
        const { ListingId } = req.params;
        const listing = await Listings.findOne({
            where: {
                ListingId
            }
        });
        if (!listing) {
            return res.status(500).json({
                message: "Lỗi không thấy sản phẩm",
            });
        }

        await listing.destroy();
        return res.status(200).json({
            success: true,
            message: "Xóa sản phẩm thành công ",
        })

    }
    catch (error) {
        return res.status(404).json({
            success: false,
            message: "Lỗi xóa dữ liệu sản phẩm không thành công",
            error: error
        });
    }
}

const updateListing = async (req, res) => {
    try {
        const { ListingId } = req.params;
        const listing = await Listings.findOne({
            where: { ListingId }
        });
        if (!listing) {
            return res.status(500).json({
                message: "Lỗi không thấy sản phẩm",
            });
        }
        const ownsStore = await Store.findOne({
            where: { StoreId: listing.StoreId, OwnerId: req.user.UserId },
        });
        if (!ownsStore || Number(listing.SellerId) !== Number(req.user.UserId)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền sửa sản phẩm này",
            });
        }


        const { CategoryId, Title, Description, Price, ConditionLevel, KnownDefects, Location } = req.body;
        const updateListing = await listing.update({ CategoryId, Title, Description, Price, ConditionLevel, KnownDefects, Location });
        return res.status(200).json({
            success: true,
            message: "Sửa sản phẩm thành công ",
            data: updateListing
        })

    }
    catch (error) {
        return res.status(404).json({
            success: false,
            message: "Lỗi sửa dữ liệu sản phẩm không thành công",
            error: error
        });
    }
}
const hiddenListing = async (req, res) => {
    try {
        const { ListingId } = req.params;
        const listing = await Listings.findOne({
            where: { ListingId }
        });
        if (!listing) {
            return res.status(500).json({
                message: "Lỗi không thấy sản phẩm",
            });
        }
        const ownsStore = await Store.findOne({
            where: { StoreId: listing.StoreId, OwnerId: req.user.UserId },
        });
        if (!ownsStore || Number(listing.SellerId) !== Number(req.user.UserId)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thay đổi sản phẩm này",
            });
        }

        if (!["ACTIVE", "HIDDEN"].includes(listing.Status)) {
            return res.status(409).json({
                success: false,
                message: "Chỉ có thể ẩn sản phẩm đang bán hoặc đã ẩn ",
            })
        }

        const newStatus = listing.Status === "ACTIVE" ? "HIDDEN" : "ACTIVE";

        const hidden = await listing.update({
            Status: newStatus,
        })
        return res.status(200).json({
            success: true,
            message: newStatus === "HIDDEN" ?
                "Ẩn sản phẩm thành công" :
                "Hiện sản phẩm thành công"
        })


    }
    catch (error) {
        return res.status(404).json({
            success: false,
            message: "Lỗi ẩn sản phẩm không thành công",
            error: error.message
        });
    }
}
module.exports = { createListing, getAllListingStore, getListingId, updateListing, hiddenListing };