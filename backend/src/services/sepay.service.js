'use strict';

const crypto = require('node:crypto');
const { SePayPgClient } = require('sepay-pg-node');
const { badRequest, conflict, notFound } = require('../utils/httpError');
const {
  sequelize,
  CreditPackages,
  CreditTransactions,
  UserCredits,
} = require('../models');

const getClient = () => {
  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const secretKey = process.env.SEPAY_SECRET_KEY;
  if (!merchantId || !secretKey) {
    throw new Error('Thiếu cấu hình SEPAY_MERCHANT_ID hoặc SEPAY_SECRET_KEY.');
  }
  return new SePayPgClient({
    env: process.env.SEPAY_ENV || 'sandbox',
    merchant_id: merchantId,
    secret_key: secretKey,
  });
};

const invoiceFor = transactionId => `CREDIT-${transactionId}`;
const PAID_STATUSES = new Set(['SUCCESS', 'PAID', 'COMPLETED', 'CAPTURED', 'APPROVED']);
const SIGNED_FIELDS = [
  'merchant', 'env', 'operation', 'payment_method', 'order_amount', 'currency',
  'order_invoice_number', 'order_description', 'customer_id', 'agreement_id',
  'agreement_name', 'agreement_type', 'agreement_payment_frequency',
  'agreement_amount_per_payment', 'success_url', 'error_url', 'cancel_url', 'order_id',
];

function verifySignature(payload) {
  const signature = payload?.signature;
  if (typeof signature !== 'string' || !signature) return false;
  const signed = SIGNED_FIELDS
    .filter(field => payload[field] !== undefined)
    .map(field => `${field}=${payload[field] ?? ''}`)
    .join(',');
  const expected = crypto.createHmac('sha256', process.env.SEPAY_SECRET_KEY)
    .update(signed)
    .digest('base64');
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function fulfillTransaction(transactionId) {
  return sequelize.transaction(async trx => {
    const locked = await CreditTransactions.findByPk(transactionId, {
      transaction: trx,
      lock: trx.LOCK.UPDATE,
    });
    if (!locked) throw notFound('Không tìm thấy giao dịch nạp credit.');
    if (locked.Status === 'SUCCESS') return locked;
    const [wallet] = await UserCredits.findOrCreate({
      where: { UserId: locked.UserId },
      defaults: { Balance: 0 },
      transaction: trx,
      lock: trx.LOCK.UPDATE,
    });
    const balance = Number(wallet.Balance) + Number(locked.Amount);
    await wallet.update({ Balance: balance }, { transaction: trx });
    await locked.update({ Status: 'SUCCESS', BalanceAfter: balance, CompletedAt: new Date() }, { transaction: trx });
    return locked;
  });
}

async function createCheckout(userId, packageId) {
  if (!Number.isSafeInteger(packageId) || packageId <= 0) {
    throw badRequest('Mã gói credit không hợp lệ.');
  }

  const creditPackage = await CreditPackages.findOne({
    where: { PackageId: packageId, Status: 'ACTIVE' },
  });
  if (!creditPackage) throw notFound('Không tìm thấy gói credit đang hoạt động.');

  const client = getClient();
  const transaction = await CreditTransactions.create({
    UserId: userId,
    PackageId: creditPackage.PackageId,
    Type: 'DEPOSIT',
    Amount: creditPackage.TotalCredit,
    MoneyAmount: creditPackage.Price,
    Status: 'PENDING',
  });
  const invoice = invoiceFor(transaction.TransactionId);
  await transaction.update({ ReferenceCode: invoice });

  const fields = client.checkout.initOneTimePaymentFields({
    operation: 'PURCHASE',
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: invoice,
    order_amount: Number(creditPackage.Price),
    currency: 'VND',
    order_description: `Nap credit ${invoice}`,
    success_url: process.env.SEPAY_SUCCESS_URL || 'http://localhost:5173/credit/packages?payment=success',
    error_url: process.env.SEPAY_ERROR_URL || 'http://localhost:5173/credit/packages?payment=error',
    cancel_url: process.env.SEPAY_CANCEL_URL || 'http://localhost:5173/credit/packages?payment=cancel',
    custom_data: JSON.stringify({ transactionId: transaction.TransactionId, userId }),
  });

  return {
    transactionId: transaction.TransactionId,
    invoice,
    checkoutUrl: client.checkout.initCheckoutUrl(),
    fields,
  };
}

async function syncCheckout(userId, invoice) {
  if (typeof invoice !== 'string' || !invoice.trim()) throw badRequest('Mã hóa đơn không hợp lệ.');
  const transaction = await CreditTransactions.findOne({
    where: { ReferenceCode: invoice.trim(), UserId: userId, Type: 'DEPOSIT' },
    include: [{ model: CreditPackages, as: 'package' }],
  });
  if (!transaction) throw notFound('Không tìm thấy giao dịch nạp credit.');
  if (transaction.Status === 'SUCCESS') return transaction;

  const response = await getClient().order.retrieve(transaction.ReferenceCode);
  const order = response.data?.data || response.data;
  const status = String(order?.order_status || order?.status || '').toUpperCase();
  const paidAmount = Number(order?.order_amount ?? order?.amount);
  if (Number.isFinite(paidAmount) && paidAmount !== Number(transaction.MoneyAmount)) {
    throw conflict('Số tiền SePay không khớp với giao dịch nạp credit.');
  }
  if (!PAID_STATUSES.has(status)) return transaction;

  return fulfillTransaction(transaction.TransactionId);
}

async function handleIpn(payload) {
  if (!payload || payload.merchant !== process.env.SEPAY_MERCHANT_ID || !verifySignature(payload)) {
    throw badRequest('IPN SePay không hợp lệ.');
  }
  const invoice = String(payload.order_invoice_number || '').trim();
  const amount = Number(payload.order_amount);
  if (!invoice || !Number.isFinite(amount)) throw badRequest('IPN SePay thiếu thông tin giao dịch.');
  const transaction = await CreditTransactions.findOne({
    where: { ReferenceCode: invoice, Type: 'DEPOSIT' },
  });
  if (!transaction) throw notFound('Không tìm thấy giao dịch nạp credit.');
  if (amount !== Number(transaction.MoneyAmount)) throw conflict('Số tiền IPN SePay không khớp.');
  const status = String(payload.order_status || '').toUpperCase();
  if (PAID_STATUSES.has(status)) await fulfillTransaction(transaction.TransactionId);
  return { received: true, status };
}

module.exports = { createCheckout, syncCheckout, handleIpn };
