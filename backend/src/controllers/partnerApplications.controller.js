const PartnerApplications = require("../models/PartnerApplications.model");
const UserRoles = require("../models/UserRoles.model");
const Roles = require("../models/Roles.model");
const { sendOTPEmail } = require("../services/email.service");
const crypto = require("crypto");
const VerificationCodes = require("../models/VerificationCodes.model");
const {
  sendPartnerOtpSchema,
  verifyPartnerOtpSchema,
  createPartnerApplicationSchema,
} = require("../validators/partnerApplication.validator");
const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex")
}

const sendPartnerOtp = async (req, res) => {
  try {
    const result = sendPartnerOtpSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message,
      });
    }
    const { email } = result.data;

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
  try {
    const result = verifyPartnerOtpSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message,
      })
    }

    const email = result.data.email;
    const otp = result.data.otp;

    const record = await VerificationCodes.findOne({
      where: {
        Recipient: email,
        Purpose: "PARTNER_APPLICATION",
        UsedAt: null,
      },
      order: [["CreatedAt", "DESC"]],
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP không tồn tại",
      });
    }

    if (new Date() > record.ExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP đã hết hạn",
      });
    }

    const codeHash = hashOtp(otp);

    if (codeHash !== record.CodeHash) {
      return res.status(400).json({
        success: false,
        message: "OTP không đúng",
      });
    }

    await record.update({ UsedAt: new Date() });

    return res.json({
      success: true,
      message: "Xác thực OTP thành công",
    });
  }
  catch (err) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    })
  }
};

const createPartnerApplication = async (req, res) => {
  try {
    const result = createPartnerApplicationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message
      })
    }
    const { UserId, PartnerType, IdentityNumberMasked } = result.data;

    const IdentityImageUrl = req.file
      ? `/upload/partnerApplication/${req.file.filename}`
      : null;

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
            RoleName: ["DRIVER", "SELLER"],
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
      return res.status(404).json({
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