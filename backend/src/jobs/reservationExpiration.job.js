'use strict';

const orderConfig = require('../config/order.config');
const { expireReservations } = require('../services/order.service');

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const { expiredCount } = await expireReservations();
    if (expiredCount > 0) console.log(`[ReservationJob] Đã hủy ${expiredCount} đơn hết thời gian giữ.`);
  } catch (error) {
    console.error('[ReservationJob] Không thể xử lý đơn hết hạn:', error.message);
  } finally {
    running = false;
  }
}

function startReservationExpirationJob() {
  if (timer) return timer;
  void runOnce();
  timer = setInterval(runOnce, orderConfig.expirationScanMs);
  timer.unref?.();
  return timer;
}

function stopReservationExpirationJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = { runOnce, startReservationExpirationJob, stopReservationExpirationJob };
