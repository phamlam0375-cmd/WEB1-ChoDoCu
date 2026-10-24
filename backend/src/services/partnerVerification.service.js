"use strict";

// Nối dữ liệu của trang đăng ký đối tác (C01) vào phần duyệt hồ sơ:
// - C01 xác thực email bằng OTP và ghi vào VerificationCodes (UsedAt khác null) nhưng không
//   cập nhật Users.EmailVerified, nên coi OTP đã dùng cũng là đã xác thực.
// - C01 lưu ảnh giấy tờ ở backend/upload/partnerApplication với đường dẫn /upload/partnerApplication/<tệp>.
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { VerificationCodes } = require("../models");
const { UPLOAD_DIR } = require("../controllers/uploads.controller");

const PARTNER_UPLOAD_DIR = path.resolve(__dirname, "../../upload");
const EMAIL_CHANNELS = ["EMAIL"];
const PHONE_CHANNELS = ["SMS", "PHONE"];

const normalize = (value) => String(value || "").trim().toLowerCase();

// applicants: [{ UserId, Email, Phone, EmailVerified, PhoneVerified }]
// Trả Map UserId → { email, phone, emailBy, phoneBy } ("ACCOUNT" | "OTP" | null).
const verificationOf = async (applicants, { transaction } = {}) => {
  const list = applicants.filter(Boolean);
  const recipients = [...new Set(list.flatMap((user) => [normalize(user.Email), normalize(user.Phone)]).filter(Boolean))];
  const codes = recipients.length
    ? await VerificationCodes.findAll({
        where: { Recipient: recipients, UsedAt: { [Op.ne]: null } },
        attributes: ["Recipient", "Channel"],
        transaction,
      })
    : [];
  const used = new Set(codes.map((code) => `${String(code.Channel).toUpperCase()}|${normalize(code.Recipient)}`));
  const hasCode = (channels, recipient) => Boolean(recipient) && channels.some((channel) => used.has(`${channel}|${recipient}`));

  return new Map(
    list.map((user) => {
      const emailBy = user.EmailVerified ? "ACCOUNT" : hasCode(EMAIL_CHANNELS, normalize(user.Email)) ? "OTP" : null;
      const phoneBy = user.PhoneVerified ? "ACCOUNT" : hasCode(PHONE_CHANNELS, normalize(user.Phone)) ? "OTP" : null;
      return [user.UserId, { email: Boolean(emailBy), phone: Boolean(phoneBy), emailBy, phoneBy }];
    })
  );
};

// Gắn trạng thái xác thực đã gộp vào Applicant của từng hồ sơ (đối tượng thường).
const withVerification = async (applications) => {
  const plain = applications.map((item) => (item.get ? item.get({ plain: true }) : item));
  const map = await verificationOf(plain.map((item) => item.Applicant));
  return plain.map((item) => {
    if (!item.Applicant) return item;
    const state = map.get(item.Applicant.UserId);
    return {
      ...item,
      Applicant: {
        ...item.Applicant,
        EmailVerified: state.email,
        PhoneVerified: state.phone,
        EmailVerifiedBy: state.emailBy,
        PhoneVerifiedBy: state.phoneBy,
      },
    };
  });
};

// Đường dẫn tệp ảnh giấy tờ trên máy chủ (chỉ trong thư mục tải lên), null nếu không có tệp.
const identityImageFile = (url) => {
  const value = String(url || "");
  const sources = [
    { prefix: "/upload/", dir: PARTNER_UPLOAD_DIR },
    { prefix: "/api/v1/uploads/", dir: UPLOAD_DIR },
  ];
  const source = sources.find(({ prefix }) => value.startsWith(prefix));
  if (!source) return null;
  const file = path.resolve(source.dir, decodeURIComponent(value.slice(source.prefix.length)));
  if (!file.startsWith(source.dir + path.sep) || !fs.existsSync(file)) return null;
  return file;
};

module.exports = { verificationOf, withVerification, identityImageFile };
