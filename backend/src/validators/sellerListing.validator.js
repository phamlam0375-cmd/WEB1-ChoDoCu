const { z } = require("zod");

const idSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^[1-9]\d*$/, "Mã không hợp lệ"),
]).transform(Number);

const priceSchema = z.union([
  z.number().finite().nonnegative(),
  z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Giá bán không hợp lệ").transform(Number),
]);

const optionalText = (max) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(max).nullable().optional(),
);

const createListingSchema = z.object({
  StoreId: idSchema,
  CategoryId: idSchema,
  Title: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm").max(180, "Tên sản phẩm tối đa 180 ký tự"),
  Description: z.string().trim().min(1, "Vui lòng nhập mô tả sản phẩm").max(10000, "Mô tả sản phẩm tối đa 10000 ký tự"),
  Price: priceSchema,
  ConditionLevel: z.string().trim().min(1, "Vui lòng nhập tình trạng sản phẩm").max(30, "Tình trạng sản phẩm không hợp lệ"),
  KnownDefects: optionalText(10000),
  Location: optionalText(255),
});

const updateListingSchema = createListingSchema.partial().extend({
  UpdatedAt: z.string().datetime({ offset: true }),
}).refine(
  (data) => Object.keys(data).some((key) => key !== "UpdatedAt"),
  "Vui lòng nhập ít nhất một trường cần cập nhật",
);

module.exports = { createListingSchema, updateListingSchema };
