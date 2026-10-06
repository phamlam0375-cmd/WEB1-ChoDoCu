const { z } = require("zod");

const sendPartnerOtpSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Chưa nhập email")
        .email("Email không hợp lệ"),
});

const verifyPartnerOtpSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Chưa nhập email")
        .email("Email không hợp lệ"),

    otp: z
        .string()
        .regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số"),
});

const createPartnerApplicationSchema = z.object({
    UserId: z.coerce
        .number()
        .int("UserId phải là số nguyên")
        .positive("UserId không hợp lệ"),

    PartnerType: z.enum(["SELLER", "DRIVER"], {
        message: "Vui lòng chọn loại đối tác",
    }),

    IdentityNumberMasked: z
        .string()
        .trim()
        .regex(/^\d{12}$/, "Số CCCD không hợp lệ")
        .optional()
        .nullable(),
});

module.exports = {
    sendPartnerOtpSchema,
    verifyPartnerOtpSchema,
    createPartnerApplicationSchema,
};