const { Store } = require("../models");
const {
    ownerIdSchema,
    updateStoreSchema,
} = require("../validators/store.validator");

const getAllStore = async (req, res) => {
    try {
        const store = await Store.findAll();

        if (!store) {
            return res.status(200).json({
                success: true,
                message: `Không có cửa hàng trong database`,
            })
        }
        return res.status(200).json({
            success: true,
            message: "Lấy cửa hàng thành công",
            data: store
        })
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: `Lấy cửa hàng không thành công: ${err.message}`,
        })
    }
}

const getStore = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const ownerIdResult = ownerIdSchema.safeParse(ownerId);

        if (!ownerIdResult.success) {
            return res.status(400).json({
                success: false,
                message: "OwnerId không hợp lệ",
            });
        }

        const store = await Store.findOne({
            where: {
                OwnerId: ownerIdResult.data,
            }

        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: `User không có cửa hàng`,
            })
        }

        return res.status(200).json({
            success: true,
            message: "Lấy cửa hàng thành công",
            data: store
        })
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: `Lấy cửa hàng không thành công: ${err.message}`,
        })
    }
}

const updateStore = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const ownerIdResult = ownerIdSchema.safeParse(ownerId);
        const bodyResult = updateStoreSchema.safeParse(req.body);

        if (!ownerIdResult.success || !bodyResult.success) {
            return res.status(400).json({
                success: false,
                message: !ownerIdResult.success
                    ? "OwnerId không hợp lệ"
                    : "Dữ liệu cửa hàng không hợp lệ",
                errors: bodyResult.success
                    ? undefined
                    : bodyResult.error.issues.map((issue) => issue.message),
            });
        }

        const store = await Store.findOne({
            where: { OwnerId: ownerIdResult.data }
        })

        if (!store) {
            return res.status(404).json({
                success: false,
                message: `User không có cửa hàng`,
            })
        }

        await store.update(bodyResult.data);
        return res.status(200).json({
            success: true,
            message: `Sửa cửa hàng thành công`,
            data: store
        })
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: `Sửa không thành công`,
        })
    }
}

module.exports = {
    getAllStore, getStore, updateStore
}