const PartnerApplications = require("../models/PartnerApplications.model");

const createPartnerApplication = async (req, res) => {
  try {
    const {
      UserId,
      PartnerType,
      IdentityImageUrl,
      IdentityNumberMasked,
    } = req.body;

    if (!UserId) {
      return res.status(400).json({
        message: "UserId là bắt buộc",
      });
    }
    if (!PartnerType) {
      return res.status(400).json({
        message: "PartnerType là bắt buộc",
      });
    }


    if (!["SELLER", "DRIVER"].includes(PartnerType)) {
      return res.status(400).json({
        message: "Loại partner không hợp lệ ",
      });
    }

    const application = await PartnerApplications.create({
      UserId,
      PartnerType,
      IdentityImageUrl,
      IdentityNumberMasked,
      Status: "PENDING",
    });

    return res.status(201).json({
      success: true,
      message: "Tạo đơn đăng ký thành công",
      data: application,
    });
  } catch (error) {
    console.error("Create partner application error:", error);

    return res.status(500).json({
      message: "Lỗi server",
    });
  }
};

module.exports = {
  createPartnerApplication,
};