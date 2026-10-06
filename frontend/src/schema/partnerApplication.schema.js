import { z } from "zod";

export const partnerApplicationSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Chưa nhập email")
        .email("Email không hợp lệ"),

    identityNumberMasked: z
        .string()
        .trim()
        .min(1, "Chưa nhập số CCCD")
        .regex(/^\d{12}$/, "CCCD phải có đúng 12 số"),

    otp: z
        .string()
        .trim()
        .min(1, "Chưa nhập OTP")
        .regex(/^\d{6}$/, "OTP phải đủ 6 số"),
});