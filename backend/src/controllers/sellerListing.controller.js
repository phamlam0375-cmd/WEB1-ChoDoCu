'use strict';

const { Sequelize } = require("sequelize");
const { Listings, ListingMedia, Store, Users, Categories, ConditionOptions } = require("../models");
const { createListingSchema, updateListingSchema } = require("../validators/sellerListing.validator");

const createListing = async (req, res) => {
    const validationResult = createListingSchema.safeParse(req.body || {});
    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            message: "Dữ liệu đăng tin không hợp lệ",
            errors: validationResult.error.issues.map((issue) => issue.message),
        });
    }
    const { StoreId, CategoryId, Title, Description, Price, ConditionLevel, KnownDefects, Location } = validationResult.data;

    const [store, category, condition] = await Promise.all([
        Store.findOne({ where: { StoreId, OwnerId: req.user.UserId } }),
        Categories.findOne({ where: { CategoryId, Status: "ACTIVE" } }),
        ConditionOptions.findOne({ where: { ConditionCode: ConditionLevel, Status: "ACTIVE" } }),
    ]);
    if (!store) {
        return res.status(403).json({
            success: false,
            message: "Bạn không có quyền đăng sản phẩm cho cửa hàng này",
        });
    }
    if (!category) {
        throw badRequest("Danh mục không tồn tại hoặc đang bị ẩn");
    }
    if (!condition) {
        throw badRequest("Tình trạng sản phẩm không tồn tại hoặc đang bị ẩn");
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

    if (req.files && req.files.length > 0) {
        const mediaRecords = req.files.map((file, index) => ({
            ListingId: listing.ListingId,
            MediaType: "IMAGE",
            MediaUrl: `/api/v1/uploads/listings/${file.filename}`,
            SortOrder: index + 1,
        }));
        await ListingMedia.bulkCreate(mediaRecords);
    }

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
    });
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
            where: { ListingId },
            include: [
                {
                    model: Users,
                    as: "Seller",
                    attributes: ["UserId", "FullName", "EmailVerified", "AvatarUrl"],
                },
                {
                    model: Categories,
                    as: "Category",
                    attributes: ["CategoryId", "CategoryName"],
                },
                {
                    model: ListingMedia,
                    as: "Media",
                    attributes: ["MediaId", "MediaUrl", "MediaType", "SortOrder"],
                    separate: true,
                    order: [["SortOrder", "ASC"]],
                },
            ],
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


        const validationResult = updateListingSchema.safeParse(req.body || {});
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu cập nhật không hợp lệ",
                errors: validationResult.error.issues.map((issue) => issue.message),
            });
        }

        const updateData = validationResult.data;
        if (updateData.CategoryId !== undefined) {
            const category = await Categories.findOne({
                where: { CategoryId: updateData.CategoryId, Status: "ACTIVE" },
            });
            if (!category) {
                return res.status(400).json({
                    success: false,
                    message: "Danh mục không tồn tại hoặc đang bị ẩn",
                });
            }
        }
        if (updateData.ConditionLevel !== undefined) {
            const condition = await ConditionOptions.findOne({
                where: { ConditionCode: updateData.ConditionLevel, Status: "ACTIVE" },
            });
            if (!condition) {
                return res.status(400).json({
                    success: false,
                    message: "Tình trạng sản phẩm không tồn tại hoặc đang bị ẩn",
                });
            }
        }

        const changed = Object.keys(updateData).some((field) => {
            if (field === "Price") {
                return Number(listing[field]) !== Number(updateData[field]);
            }
            const current = listing[field] == null ? null : String(listing[field]);
            const next = updateData[field] == null ? null : String(updateData[field]);
            return current !== next;
        });
        if (changed && listing.Status === "ACTIVE") {
            updateData.Status = "PENDING";
            updateData.ModerationNote = null;
        }

        const updated = await listing.update(updateData);
        return res.status(200).json({
            success: true,
            message: "Sửa sản phẩm thành công ",
            data: updated
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