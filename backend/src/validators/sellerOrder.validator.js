const { z } = require('zod');

const updateSellerOrderStatusSchema = z
    .object({
        status: z.enum(['CONFIRM', 'CONFIRMED', 'REJECTED']),
        reason: z.string().trim().max(500).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.status === "REJECTED" && !data.reason) {
            ctx.addIssue({
                code: "custom",
                path: ["reason"],
                message: "Vui lòng nhập lý do từ chối.",
            })
        }
    })
module.exports = {
    updateSellerOrderStatusSchema,
};