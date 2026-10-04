const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOTPEmail(email, otp) {
  try {
    const result = await transporter.sendMail({
      from: `"Chợ Đồ Cũ" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mã OTP đăng ký đối tác",
      text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
      html: `
        <div style="font-family:Arial;padding:32px;background:#f0fdf4">
          <div style="max-width:520px;margin:auto;padding:32px;background:white;border-radius:16px">
            <h1 style="color:#059669">Chợ Đồ Cũ</h1>
            <p>Mã OTP đăng ký đối tác của bạn là:</p>
            <div style="padding:18px;text-align:center;background:#ecfdf5;border-radius:12px">
              <strong style="font-size:36px;letter-spacing:10px;color:#047857">
                ${otp}
              </strong>
            </div>
            <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
          </div>
        </div>
      `,
    });

    console.log("Email sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("Gmail error:", error);
    throw error;
  }
}

module.exports = { sendOTPEmail };