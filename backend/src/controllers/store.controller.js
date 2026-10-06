const { Store, Users } = require("../models");

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

        const store = await Store.findOne({
            where: {
                OwnerId: ownerId
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
        const ownerId = 4;
        const store = await Store.findOne({
            where: { OwnerId: ownerId }
        })

        if (!store) {
            return res.status(404).json({
                success: false,
                message: `User không có cửa hàng`,
            })
        }

        const storeNameRegex = /^.{1,120}$/;
        const descriptionRegex = /^.{0,500}$/;
        const addressRegex = /^.{0,255}$/;

        const latitudeRegex = /^-?\d{1,3}(\.\d{1,7})?$/;
        const longitudeRegex = /^-?\d{1,3}(\.\d{1,7})?$/;

        const bankNameRegex = /^.{0,80}$/;
        const bankAccountNumberRegex = /^.{0,30}$/;
        const bankAccountHolderRegex = /^.{0,100}$/;

        const qrImageUrlRegex = /^.{0,255}$/;
        const statusRegex = /^.{1,20}$/;

        if (
            !storeNameRegex.test(StoreName) ||
            !descriptionRegex.test(Description) ||
            !addressRegex.test(Address) ||
            !bankNameRegex.test(BankName) ||
            !bankAccountNumberRegex.test(BankAccountNumber) ||
            !bankAccountHolderRegex.test(BankAccountHolder) ||
            !qrImageUrlRegex.test(QrImageUrl) ||
            !statusRegex.test(Status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu cửa hàng không hợp lệ"
            });
        }

        await store.update(req.body);
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