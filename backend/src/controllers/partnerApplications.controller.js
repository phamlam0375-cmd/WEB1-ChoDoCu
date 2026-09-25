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
      message: error.message || "Lỗi tạo không thành công",
    });
  }
};


const getAllPatnerApplication = async (req, res) => {
  try {
    const applications = await PartnerApplications.findAll();
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách đăng ký thành công",
      data: applications
    })
  }
  catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    })
  }
}

const getPatnerApplicationId = async (req, res) => {
  try {
    const applications = await PartnerApplications.findByPk(req.params.id);

    if (!applications) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy đăng ký"
      })
    }

    return res.status(200).json({
      success: true,
      message: "Lấy đăng ký thành công",
      data: applications
    })
  }
  catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    })
  }
}
module.exports = {
  createPartnerApplication, getAllPatnerApplication, getPatnerApplicationId
};