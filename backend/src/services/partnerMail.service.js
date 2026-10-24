"use strict";

// Email báo kết quả xét duyệt hồ sơ đối tác (B02), gửi bằng cùng tài khoản Gmail với email OTP
// (biến môi trường EMAIL_USER, EMAIL_PASS). Chưa cấu hình thì bỏ qua: thông báo trong web vẫn có.
const nodemailer = require("nodemailer");

const SEND_TIMEOUT_MS = 10000;

const DECISION_TEXT = {
  APPROVED: { subject: "Hồ sơ đối tác đã được duyệt", color: "#059669", heading: "Chúc mừng, hồ sơ của bạn đã được duyệt" },
  REJECTED: { subject: "Hồ sơ đối tác bị từ chối", color: "#dc2626", heading: "Rất tiếc, hồ sơ của bạn chưa được duyệt" },
  NEED_INFO: { subject: "Hồ sơ đối tác cần bổ sung", color: "#d97706", heading: "Hồ sơ của bạn cần bổ sung thông tin" },
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Gửi email quá thời gian chờ")), SEND_TIMEOUT_MS)),
  ]);

// Gửi một email theo mẫu chung của trang quản trị. `messageHtml` đã được escape sẵn.
// Trả { sent: true } hoặc { sent: false, reason } — không bao giờ ném lỗi, để thao tác quản trị không bị ảnh hưởng.
async function sendAdminEmail({ to, fullName, subject, heading, color, message, messageHtml, note, noteLabel = "Ghi chú của quản trị" }) {
  if (!to) return { sent: false, reason: "Không có địa chỉ email" };
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { sent: false, reason: "Máy chủ chưa cấu hình email (EMAIL_USER, EMAIL_PASS)" };
  }

  const noteBlock = note
    ? `<p style="margin:16px 0 0;padding:12px 16px;background:#f8fafc;border-radius:10px"><strong>${noteLabel}:</strong> ${escapeHtml(note)}</p>`
    : "";
  try {
    await withTimeout(
      getTransporter().sendMail({
        from: `"Chợ Đồ Cũ" <${process.env.EMAIL_USER}>`,
        to,
        subject: `[Chợ Đồ Cũ] ${subject}`,
        text: `Chào ${fullName},\n\n${message}${note ? `\n\n${noteLabel}: ${note}` : ""}\n\nChợ Đồ Cũ`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:32px;background:#f0fdf4">
            <div style="max-width:560px;margin:auto;padding:32px;background:#ffffff;border-radius:16px">
              <h1 style="margin:0 0 16px;color:#059669;font-size:22px">Chợ Đồ Cũ</h1>
              <h2 style="margin:0 0 12px;color:${color};font-size:18px">${heading}</h2>
              <p>Chào <strong>${escapeHtml(fullName)}</strong>,</p>
              <p>${messageHtml ?? escapeHtml(message)}</p>
              ${noteBlock}
              <p style="margin-top:24px;color:#64748b;font-size:13px">Email gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>`,
      })
    );
    return { sent: true };
  } catch (error) {
    console.error("[partnerMail] Không gửi được email:", error.message);
    return { sent: false, reason: "Không gửi được email" };
  }
}

async function sendPartnerDecisionEmail({ to, fullName, partnerLabel, status, message, note }) {
  const text = DECISION_TEXT[status];
  if (!text) return { sent: false, reason: "Trạng thái hồ sơ không hợp lệ" };
  return sendAdminEmail({
    to,
    fullName,
    subject: text.subject,
    heading: text.heading,
    color: text.color,
    message,
    messageHtml: `Về hồ sơ đăng ký làm <strong>${escapeHtml(partnerLabel)}</strong>: ${escapeHtml(message)}`,
    note,
  });
}

// B01: tài khoản bị khóa không đăng nhập được để đọc thông báo trong web, nên báo thêm qua email.
const ACCOUNT_STATUS_TEXT = {
  LOCKED: {
    subject: "Tài khoản của bạn đã bị khóa",
    color: "#dc2626",
    heading: "Tài khoản của bạn đã bị khóa",
    message: "Quản trị viên đã khóa tài khoản Chợ Đồ Cũ của bạn. Trong thời gian bị khóa, bạn không thể đăng nhập, đăng tin hay đặt hàng. Nếu cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên của website.",
  },
  ACTIVE: {
    subject: "Tài khoản của bạn đã được mở khóa",
    color: "#059669",
    heading: "Tài khoản của bạn đã được mở khóa",
    message: "Quản trị viên đã mở khóa tài khoản Chợ Đồ Cũ của bạn. Bạn có thể đăng nhập và sử dụng lại bình thường.",
  },
};

async function sendAccountStatusEmail({ to, fullName, status, reason }) {
  const text = ACCOUNT_STATUS_TEXT[status];
  if (!text) return { sent: false, reason: "Trạng thái tài khoản không hợp lệ" };
  return sendAdminEmail({ to, fullName, ...text, note: reason, noteLabel: "Lý do" });
}

module.exports = { sendPartnerDecisionEmail, sendAccountStatusEmail };
