const { z } = require("zod");

const latitudeSchema = z.union([
    z.number()
        .finite()
        .min(-90, "Vĩ độ phải từ -90 đến 90")
        .max(90, "Vĩ độ phải từ -90 đến 90"),
    z.string()
        .regex(/^-?\d{1,3}(\.\d{1,7})?$/, "Tọa độ không hợp lệ")
        .transform(Number)
        .pipe(z.number().min(-90, "Vĩ độ phải từ -90 đến 90").max(90, "Vĩ độ phải từ -90 đến 90")),
]);

const longitudeSchema = z.union([
    z.number()
        .finite()
        .min(-180, "Kinh độ phải từ -180 đến 180")
        .max(180, "Kinh độ phải từ -180 đến 180"),
    z.string()
        .regex(/^-?\d{1,3}(\.\d{1,7})?$/, "Tọa độ không hợp lệ")
        .transform(Number)
        .pipe(z.number().min(-180, "Kinh độ phải từ -180 đến 180").max(180, "Kinh độ phải từ -180 đến 180")),
]);

const ownerIdSchema = z.string()
    .regex(/^[1-9]\d*$/, "OwnerId không hợp lệ")
    .transform(Number);

const updateStoreSchema = z.object({
    StoreName: z.string().regex(/^.{1,120}$/, "Tên cửa hàng không hợp lệ"),
    Description: z.string().regex(/^.{0,500}$/, "Mô tả không hợp lệ").nullable().optional(),
    Address: z.string().regex(/^.{0,255}$/, "Địa chỉ không hợp lệ").nullable().optional(),
    Latitude: latitudeSchema.nullable().optional(),
    Longitude: longitudeSchema.nullable().optional(),
    IsDemoLocation: z.boolean().optional(),
    BankName: z.string().regex(/^.{0,80}$/, "Tên ngân hàng không hợp lệ").nullable().optional(),
    BankAccountNumber: z.string().regex(/^.{0,30}$/, "Số tài khoản không hợp lệ").nullable().optional(),
    BankAccountHolder: z.string().regex(/^.{0,100}$/, "Tên chủ tài khoản không hợp lệ").nullable().optional(),
    QrImageUrl: z.string().regex(/^.{0,255}$/, "QR image URL không hợp lệ").nullable().optional(),
    Status: z.string().regex(/^.{1,20}$/, "Trạng thái không hợp lệ").optional(),
});

module.exports = {
    ownerIdSchema,
    updateStoreSchema,
};