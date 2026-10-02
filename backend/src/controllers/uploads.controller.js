"use strict";

// Tải ảnh bằng chứng (báo cáo vi phạm, hoàn tiền, chứng từ chuyển khoản).
// Trình duyệt gửi nguyên file trong body với Content-Type image/jpeg hoặc image/png.
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { badRequest } = require("../utils/httpError");

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const INVALID_IMAGE_MESSAGE = "Chỉ chấp nhận ảnh JPG, PNG, tối đa 5MB";

// Nhận diện theo byte đầu file, không tin vào phần mở rộng hay Content-Type.
const detectType = (buffer) => {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
};

const uploadImage = async (req, res) => {
  const buffer = Buffer.isBuffer(req.body) ? req.body : null;
  if (!buffer || !buffer.length || buffer.length > MAX_BYTES) throw badRequest(INVALID_IMAGE_MESSAGE);
  const extension = detectType(buffer);
  if (!extension) throw badRequest(INVALID_IMAGE_MESSAGE);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

  return res.status(201).json({
    success: true,
    message: "Tải ảnh thành công",
    data: { url: `/api/v1/uploads/${fileName}`, size: buffer.length },
  });
};

module.exports = { UPLOAD_DIR, MAX_BYTES, INVALID_IMAGE_MESSAGE, uploadImage };
