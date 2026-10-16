'use strict';

const { Listings, ListingMedia, Categories, Users } = require("../models");

const getAllListing = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const { count, rows } = await Listings.findAndCountAll({
            where: { Status: "ACTIVE" },
            include: [
                { model: Categories, as: "Category", attributes: ["CategoryId", "CategoryName"] },
                { model: Users, as: "Seller", attributes: ["UserId", "FullName", "EmailVerified", "AvatarUrl"] },
                {
                    model: ListingMedia,
                    as: "Media",
                    attributes: ["MediaId", "MediaUrl", "MediaType", "SortOrder"],
                    separate: true,
                    order: [["SortOrder", "ASC"]],
                },
            ],
            order: [["CreatedAt", "DESC"]],
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
    } catch (error) {
        console.log(error.message);

        return res.status(500).json({
            success: false,
            message: "Lỗi lấy dữ liệu sản phẩm không thành công",
        });
    }
}

module.exports={getAllListing}