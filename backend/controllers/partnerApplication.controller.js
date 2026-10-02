const PartnerApplications = require("../models/PartnerApplications");

const createPartnerApplication = async (req, res) => {
  try {
    const {
      UserId,
      PartnerType,
      IdentityImageUrl,
      IdentityNumberMasked,
    } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!UserId || !PartnerType) {
      return res.status(400).json({
        message: "UserId và PartnerType là bắt buộc",
      });
    }

    // Kiểm tra loại đối tác
    if (!["DRIVER", "SELLER"].includes(PartnerType)) {
      return res.status(400).json({
        message: "PartnerType chỉ được là DRIVER hoặc SELLER",
      });
    }

    // Tạo đơn đăng ký
    const application = await PartnerApplications.create({
      UserId,
      PartnerType,
      IdentityImageUrl,
      IdentityNumberMasked,
      Status: "PENDING",
    });

    return res.status(201).json({
      message: "Tạo đơn đăng ký thành công",
      data: application,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Lỗi server",
    });
  }
};

module.exports = {
  createPartnerApplication,
};