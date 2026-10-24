'use strict';

const nodemailer = require('nodemailer');

function usesDevelopmentOtpLog() {
  return (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')
    && process.env.OTP_DELIVERY_MODE !== 'email';
}

async function sendOtpEmail({ to, code, purpose, subject, html }) {
  if (usesDevelopmentOtpLog()) {
    console.info(`[OTP][development] purpose=${purpose} to=${to} code=${code}`);
    return { delivery: 'development-log' };
  }

  const user = process.env.MAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.MAIL_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('Thiếu MAIL_USER hoặc MAIL_PASS để gửi email OTP.');
  }

  const port = Number(process.env.MAIL_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  await transporter.sendMail({
    from: `"Chợ Đồ Cũ" <${user}>`,
    to,
    subject,
    html
  });

  return { delivery: 'email' };
}

module.exports = { sendOtpEmail, usesDevelopmentOtpLog };
