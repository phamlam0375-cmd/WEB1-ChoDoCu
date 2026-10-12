'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../../utils/httpError');
const { matchesAmount, snapshotBank } = require('../../validators/D03_ThanhToan/payment.validator');
const v = require('../../validators/D04_XacNhanNhanTien/confirmation.validator');
const defaultRepository = require('../../repositories/D04_XacNhanNhanTien/confirmation.repository');
const error = (code, message) => new HttpError(409, message, null, code);
const UPDATED = 'Trạng thái thanh toán đã được cập nhật trước đó.';

function reportVersion(state) {
  const p = state.payment;
  if (!p?.ProofUrl || !p.ReportedAt || !Number.isFinite(new Date(p.ReportedAt).getTime())) return null;
  // Không đưa Status/ConfirmedAt vào phiên: retry cùng quyết định phải giữ phiên.
  // ProofUrl D03 dùng UUID; HistoryId phân biệt cả hai lần báo trong cùng một giây.
  return crypto.createHash('sha256').update(JSON.stringify([
    p.PaymentId, p.OrderId, p.PayerId, p.PayeeId, String(p.Amount), p.ProofUrl,
    new Date(p.ReportedAt).toISOString(), state.report?.HistoryId || null,
    p.BankName, p.BankAccountSnapshot, p.BankAccountHolderSnapshot, p.TransferContent,
  ])).digest('hex');
}

function dataMatches(state) {
  const { order, payment: p } = state;
  return Boolean(p && Number(p.PayerId) === Number(order.BuyerId) && Number(p.PayeeId) === Number(order.SellerId)
    && matchesAmount(p.Amount, order.ProductAmount) && snapshotBank(p) && p.TransferContent && reportVersion(state));
}

function policy(state) {
  if (state.refund || ['CANCELLED', 'REFUND_PENDING', 'REFUNDED'].includes(state.order.Status)) return { canDecide: false, code: 'ORDER_BLOCKED', message: 'Đơn đã hủy hoặc đang có quy trình hoàn tiền; không thể xác nhận.' };
  if (!state.payment) return { canDecide: false, code: 'PAYMENT_NOT_REPORTED', message: 'Người mua chưa có giao dịch thanh toán.' };
  if (!dataMatches(state)) return { canDecide: false, code: 'PAYMENT_DATA_MISMATCH', message: 'Giao dịch hoặc snapshot nhận tiền chưa đầy đủ/không khớp đơn. Cần kiểm tra dữ liệu, không tự thay bằng tài khoản gian hàng mới.' };
  if (state.order.Status !== 'WAITING_PAYMENT' || state.deliveries.length) return { canDecide: false, code: 'ORDER_NOT_WAITING_PAYMENT', message: 'Đơn không ở trạng thái chờ thanh toán; không thể đổi kết quả.' };
  if (state.payment.Status !== 'REPORTED') return { canDecide: false, code: 'PAYMENT_ALREADY_UPDATED', message: state.payment.Status === 'WAITING' ? 'Người mua chưa báo chuyển tiền.' : UPDATED };
  if (state.payment.ConfirmedBy || state.payment.ConfirmedAt) return { canDecide: false, code: 'PAYMENT_DATA_MISMATCH', message: 'Giao dịch đã có dấu xác nhận nhận tiền; cần kiểm tra trước khi thao tác.' };
  return { canDecide: true, code: 'READY', message: 'Kiểm tra giao dịch trong ứng dụng ngân hàng trước khi quyết định. Biên lai không tự chứng minh đã nhận tiền.' };
}

function decisionRecord(state) {
  try { return state.decision?.Note?.startsWith('D04 ') ? JSON.parse(state.decision.Note.slice(4)) : null; } catch { return null; }
}

function detail(state) {
  const { order, payment: p, buyer, listing } = state;
  const previous = decisionRecord(state);
  return {
    orderId: Number(order.OrderId), listingId: Number(order.ListingId), sellerId: Number(order.SellerId), title: listing?.Title || null,
    buyer: { userId: Number(order.BuyerId), name: buyer?.FullName || null },
    orderStatus: order.Status, paymentId: p?.PaymentId || null, paymentStatus: p?.Status || null,
    productAmount: order.ProductAmount, deliveryFee: order.DeliveryFee, totalAmount: order.TotalAmount,
    paymentAmount: p?.Amount || null,
    bank: p ? { bankName: p.BankName, accountNumber: p.BankAccountSnapshot, accountHolder: p.BankAccountHolderSnapshot } : null,
    transferContent: p?.TransferContent || null, proofUrl: p?.ProofUrl || null, reportedAt: p?.ReportedAt || null,
    confirmedBy: p?.ConfirmedBy || null, confirmedAt: p?.ConfirmedAt || null,
    reportVersion: reportVersion(state), policy: policy(state),
    lastDecision: previous ? { ...previous, userId: state.decision.ChangedBy, at: state.decision.CreatedAt } : null,
  };
}

function createConfirmationService({ repository = defaultRepository, clock = () => new Date() } = {}) {
  const identity = user => {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    return id;
  };
  async function ownedState(id, user, transaction) {
    const userId = identity(user), state = await repository.readState(id, transaction);
    if (!state) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    if (Number(state.order.SellerId) !== userId) throw new HttpError(403, 'Bạn không có quyền xác nhận giao dịch này.', null, 'ORDER_FORBIDDEN');
    return state;
  }
  async function run(work) {
    try { return await repository.withTransaction(work); }
    catch (e) {
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e.original?.code || e.parent?.code)) throw error('PAYMENT_CONFLICT', 'Giao dịch đang được xử lý. Vui lòng tải lại.');
      throw e;
    }
  }
  async function getDetail(orderId, user) {
    const id = v.validateOrderId(orderId);
    return run(async transaction => detail(await ownedState(id, user, transaction)));
  }
  async function listPayments(query, user) {
    const sellerId = identity(user), pagination = v.validateList(query);
    const result = await repository.list(sellerId, pagination);
    return {
      data: result.rows.map(order => ({ orderId: order.OrderId, listingId: order.ListingId, title: order.Listing?.Title || null,
        buyer: { userId: order.BuyerId, name: order.Buyer?.FullName || null }, productAmount: order.ProductAmount,
        deliveryFee: order.DeliveryFee, orderStatus: order.Status, paymentStatus: order.Payment.Status, reportedAt: order.Payment.ReportedAt })),
      pagination: { page: pagination.page, limit: pagination.limit, total: result.count, totalPages: Math.max(1, Math.ceil(result.count / pagination.limit)) },
    };
  }
  async function decide(orderId, body, user) {
    const id = v.validateOrderId(orderId), input = v.validateDecision(body);
    return run(async transaction => {
      const state = await ownedState(id, user, transaction), currentPolicy = policy(state);
      if (state.refund || ['CANCELLED', 'REFUND_PENDING', 'REFUNDED'].includes(state.order.Status)) throw error(currentPolicy.code, currentPolicy.message);
      if (!dataMatches(state)) throw error('PAYMENT_DATA_MISMATCH', 'Giao dịch chưa đầy đủ hoặc không khớp đơn; vui lòng tải lại và kiểm tra.');
      if (input.reportVersion !== reportVersion(state)) throw error('PAYMENT_REPORT_CHANGED', 'Người mua đã cập nhật biên lai hoặc giao dịch đã thay đổi. Vui lòng tải lại để xem phiên mới.');
      const target = input.action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', prior = decisionRecord(state);
      if (state.payment.Status !== 'REPORTED') {
        const compatible = target === 'CONFIRMED' ? state.order.Status === 'PAID' : state.order.Status === 'WAITING_PAYMENT';
        if (compatible && !state.deliveries.length && state.payment.Status === target && prior
            && prior.reportVersion === input.reportVersion && prior.action === input.action && prior.note === input.note) {
          return { message: UPDATED, data: { ...detail(state), alreadyApplied: true } };
        }
        throw error('PAYMENT_ALREADY_UPDATED', `${UPDATED} Vui lòng tải lại; không thể đổi quyết định đã lưu.`);
      }
      if (!currentPolicy.canDecide) throw error(currentPolicy.code, currentPolicy.message);
      const now = clock(), sellerId = Number(state.order.SellerId);
      const changes = input.action === 'CONFIRM' ? { Status: target, ConfirmedBy: sellerId, ConfirmedAt: now } : { Status: target };
      if (await repository.decidePayment(state.payment, changes, transaction) !== 1) throw error('PAYMENT_CONFLICT', 'Giao dịch đã thay đổi. Vui lòng tải lại.');
      if (input.action === 'CONFIRM' && await repository.markPaid(state.order, transaction) !== 1) throw error('PAYMENT_CONFLICT', 'Đơn hàng đã thay đổi. Vui lòng tải lại.');
      const history = { OrderId: id, DeliveryId: null, ChangedBy: sellerId, CreatedAt: now };
      const savedHistory = await repository.createHistory({ ...history, StatusType: 'PAYMENT', StatusValue: target, Note: input.historyNote }, transaction);
      if (input.action === 'CONFIRM') await repository.createHistory({ ...history, StatusType: 'ORDER', StatusValue: 'PAID', Note: 'Người bán đã đối chiếu ngân hàng và xác nhận nhận đủ tiền sản phẩm.' }, transaction);
      const message = input.action === 'CONFIRM' ? `Đã xác nhận nhận tiền cho đơn #${id}.` : 'Đã thông báo cho người mua kiểm tra lại giao dịch.';
      await repository.notifyBuyer(state.order.BuyerId, { type: 'PAYMENT', title: input.action === 'CONFIRM' ? 'Người bán đã nhận đủ tiền' : 'Người bán chưa nhận được tiền',
        message: input.action === 'CONFIRM' ? `Đơn #${id}: người bán đã nhận đủ tiền sản phẩm; đơn đã PAID, chờ chuẩn bị hàng.` : `Đơn #${id}: kiểm tra giao dịch ngân hàng và gửi lại biên lai ở D03; không tự chuyển tiền lần nữa.`,
        referenceType: 'ORDER', referenceId: id, createdAt: now }, transaction);
      state.payment = { ...state.payment, ...changes };
      if (input.action === 'CONFIRM') state.order = { ...state.order, Status: 'PAID' };
      state.decision = { Note: input.historyNote, ChangedBy: sellerId, CreatedAt: now, HistoryId: savedHistory?.HistoryId };
      return { message, data: { ...detail(state), alreadyApplied: false } };
    });
  }
  return { getDetail, listPayments, decide };
}

module.exports = { ...createConfirmationService(), createConfirmationService, reportVersion, policy };
