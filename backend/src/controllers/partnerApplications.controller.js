const PartnerApplications = require("../models/PartnerApplications.model");
const UserRoles = require("../models/UserRoles.model");
const Roles = require("../models/Roles.model");
const { sendOTPEmail } = require("../services/email.service");
const crypto = require("crypto");
const VerificationCodes = require("../models/VerificationCodes.model");

const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex")
}

const sendPartnerOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email là bắt buộc",
      });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = hashOtp(otp);

    await VerificationCodes.create({
      UserId: null,
      Recipient: email,
      Channel: "EMAIL",
      Purpose: "PARTNER_APPLICATION",
      CodeHash: codeHash,
      ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      UsedAt: null,
    });

    await sendOTPEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "Đã gửi OTP vào email",
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyPartnerOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await VerificationCodes.findOne({
    where: {
      Recipient: email,
      Purpose: "PARTNER_APPLICATION",
      UsedAt: null,
    },
    order: [["CreatedAt", "DESC"]],
  });

  if (!record) {
    return res.status(400).json({ message: "OTP không tồn tại" });
  }

  if (new Date() > record.ExpiresAt) {
    return res.status(400).json({ message: "OTP đã hết hạn" });
  }

  const codeHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  if (codeHash !== record.CodeHash) {
    return res.status(400).json({ message: "OTP không đúng" });
  }

  await record.update({ UsedAt: new Date() });

  return res.json({
    success: true,
    message: "Xác thực OTP thành công",
  });
};

const createPartnerApplication = async (req, res) => {
  try {
    const {
      UserId,
      PartnerType,
      IdentityNumberMasked
    } = req.body;

    const IdentityImageUrl = req.file
      ? `/upload/partnerApplication/${req.file.filename}`
      : null;

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


    //ktra da co dang ky chua
    const existingApplication = await PartnerApplications.findOne({
      where: {
        UserId,
        Status: "PENDING",
      }
    })
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "Bạn đã có đơn đăng ký",
        data: existingApplication
      })
    }

    //ktra user co role driver hay seller chua
    const existingRole = await UserRoles.findOne({
      where: { UserId },
      include: [
        {
          model: Roles,
          where: {
            RoleName: ["DRIVER", "SELLER", "ADMIN"],
          }
        }
      ]
    })
    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: `Bạn đã là người bán/tài xế`,
        data: existingRole
      })
    }

    //ktra user role phai admin khong
    const existingRoleAdmin = await UserRoles.findOne({
      where: { UserId },
      include: [
        {
          model: Roles,
          where: {
            RoleName: ["ADMIN"],
          }
        }
      ]
    })
    if (existingRoleAdmin) {
      return res.status(409).json({
        success: false,
        message: `Admin không đăng ký được`,
        data: existingRoleAdmin
      })
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
  createPartnerApplication, getAllPatnerApplication, getPatnerApplicationId, sendPartnerOtp, verifyPartnerOtp
};