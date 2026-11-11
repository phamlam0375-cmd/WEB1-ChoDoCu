"use strict";

const { Users } = require("../models");
const { badRequest, conflict, notFound } = require("../utils/httpError");

const updateProfile = async (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  if (Object.hasOwn(body, "email") || Object.hasOwn(body, "Email")) {
    throw badRequest("Email không thể thay đổi tại đây.");
  }

  const hasFullNameUpdate = Object.hasOwn(body, "fullName");
  const hasPhoneUpdate = Object.hasOwn(body, "phone");
  const hasAddressUpdate = Object.hasOwn(body, "address");
  const hasAvatarUpdate = Object.hasOwn(body, "avatarUrl");
  if (!hasFullNameUpdate && !hasPhoneUpdate && !hasAddressUpdate && !hasAvatarUpdate) {
    throw badRequest("Không có thông tin hồ sơ để cập nhật.");
  }

  const fullName = hasFullNameUpdate ? String(body.fullName ?? "").trim() : undefined;
  const phoneInput = hasPhoneUpdate ? String(body.phone ?? "").trim() : undefined;
  const phone = phoneInput?.replace(/[\s()-]/g, "");
  const address = hasAddressUpdate ? String(body.address ?? "").trim() : undefined;
  const avatarUrl = body.avatarUrl === null ? null : String(body.avatarUrl ?? "").trim();

  if (hasFullNameUpdate && (!fullName || fullName.length > 100)) {
    throw badRequest("Họ tên phải có từ 1 đến 100 ký tự.");
  }
  if (hasPhoneUpdate && phone && !/^\+?\d{7,15}$/.test(phone)) {
    throw badRequest("Số điện thoại phải có từ 7 đến 15 chữ số.");
  }
  if (hasAddressUpdate && address.length > 255) {
    throw badRequest("Địa chỉ không được vượt quá 255 ký tự.");
  }
  if (
    hasAvatarUpdate &&
    avatarUrl &&
    (avatarUrl.length > 255 || !/^\/api\/v1\/uploads\/[\w-]+\.(?:jpg|png)$/i.test(avatarUrl))
  ) {
    throw badRequest("Ảnh đại diện không hợp lệ. Vui lòng chọn ảnh JPG hoặc PNG đã tải lên.");
  }

  const user = await Users.findByPk(req.user.UserId);
  if (!user) throw notFound("Không tìm thấy tài khoản.");

  if (hasPhoneUpdate && phone) {
    const existingPhone = await Users.findOne({
      where: { Phone: phone },
      attributes: ["UserId"],
    });
    if (existingPhone && existingPhone.UserId !== user.UserId) {
      throw conflict("Số điện thoại này đã được sử dụng.");
    }
  }

  const updates = {};
  if (hasFullNameUpdate) updates.FullName = fullName;
  if (hasPhoneUpdate) updates.Phone = phone || null;
  if (hasAddressUpdate) updates.Address = address || null;
  if (hasAvatarUpdate) updates.AvatarUrl = avatarUrl || null;
  await user.update(updates);

  return res.status(200).json({
    success: true,
    message: "Đã cập nhật hồ sơ.",
    data: {
      UserId: user.UserId,
      FullName: user.FullName,
      Email: user.Email,
      Phone: user.Phone,
      Address: user.Address,
      AvatarUrl: user.AvatarUrl,
      Status: user.Status,
      roles: req.user.roles,
    },
  });
};

module.exports = { updateProfile };
