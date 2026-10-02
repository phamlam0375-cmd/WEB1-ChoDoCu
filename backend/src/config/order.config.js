'use strict';

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function decimalRate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed.toFixed(2)
    : fallback;
}

module.exports = {
  reservationMinutes: positiveInteger(process.env.ORDER_RESERVATION_MINUTES, 15),
  expirationScanMs: positiveInteger(process.env.ORDER_RESERVATION_SCAN_MS, 30000),
  expirationBatchSize: positiveInteger(process.env.ORDER_RESERVATION_BATCH_SIZE, 50),
  commissionRate: decimalRate(process.env.ORDER_COMMISSION_RATE, '0.00')
};
