'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { UPLOAD_DIR } = require('../../controllers/uploads.controller');
const { HttpError } = require('../../utils/httpError');
const v = require('../../validators/D03_ThanhToan/payment.validator');
const defaultRepository = require('../../repositories/D03_ThanhToan/payment.repository');

const WAITING = 'Đã báo chuyển tiền — chờ người bán xác nhận';
const successMessage = 'Đã gửi thông báo chuyển khoản cho người bán.';
const transferContent = id => `THANH TOAN DON ${id}`;

const proofStorage = {
  async save(buffer, extension) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `d03-${crypto.randomUUID()}.${extension}`;
    const target = path.join(UPLOAD_DIR, name);
    await fs.writeFile(target, buffer, { flag: 'wx' });
    return { url: `/api/v1/uploads/${name}`, target };
  },
  async remove(file) { await fs.unlink(file.target); },
};

function paymentPolicy(state) {
  const { order, payment, refund, deliveries, seller, store } = state;
  const block = (code, message) => ({ canReport: false, code, message });
  if (refund || ['CANCELLED', 'REFUND_PENDING', 'REFUNDED'].includes(order.Status)) return block('ORDER_NOT_PAYABLE', 'Không thể báo chuyển tiền ở trạng thái hiện tại.');
  if (payment?.Status === 'CONFIRMED' || ['PAID', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.Status)) return block('PAYMENT_CONFIRMED', 'Giao dịch đã được xác nhận; không thể ghi đè.');
  if (order.Status === 'RESERVED') return block('SELLER_ACCEPTANCE_REQUIRED', 'Chờ người bán chấp nhận đơn hàng ở C06.');
  if (order.Status !== 'WAITING_PAYMENT' || deliveries.length) return block('ORDER_NOT_PAYABLE', 'Không thể báo chuyển tiền ở trạng thái hiện tại.');
  if (payment?.Status === 'REPORTED') return block('PAYMENT_REPORTED', WAITING);
  if (payment && !['WAITING', 'REJECTED'].includes(payment.Status)) return block('PAYMENT_NOT_REPORTABLE', 'Trạng thái thanh toán chưa được hỗ trợ.');
  if (seller?.Status !== 'ACTIVE' || store?.Status !== 'ACTIVE') return block('SELLER_UNAVAILABLE', 'Người bán hoặc gian hàng hiện không hoạt động.');
  if (payment && (Number(payment.PayerId) !== Number(order.BuyerId) || Number(payment.PayeeId) !== Number(order.SellerId) || !v.matchesAmount(payment.Amount, order.ProductAmount))) {
    return block('PAYMENT_DATA_MISMATCH', 'Thông tin giao dịch không khớp đơn hàng; cần kiểm tra trước khi thanh toán.');
  }
  if (payment ? !v.snapshotBank(payment) || !payment.TransferContent : !v.bankDetails(store)) return block('BANK_DETAILS_REQUIRED', payment ? 'Thông tin nhận tiền đã lưu chưa đầy đủ; cần người bán kiểm tra giao dịch, không tự đổi tài khoản nhận tiền.' : 'Người bán chưa cập nhật thông tin nhận tiền.');
  return { canReport: true, code: 'READY', message: payment?.Status === 'REJECTED' ? 'Người bán chưa nhận được tiền. Kiểm tra giao dịch và gửi lại biên lai; không tự chuyển tiền lần nữa.' : 'Vui lòng chuyển đúng tiền sản phẩm với nội dung đã cung cấp.' };
}

function createPaymentService({ repository = defaultRepository, storage = proofStorage, clock = () => new Date() } = {}) {
  async function ownedState(id, user, transaction) {
    const userId = Number(user?.UserId ?? user?.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.', null, 'UNAUTHORIZED');
    const state = await repository.readState(id, transaction);
    if (!state) throw new HttpError(404, 'Không tìm thấy đơn hàng.', null, 'ORDER_NOT_FOUND');
    if (Number(state.order.BuyerId) !== userId) throw new HttpError(403, 'Bạn không có quyền thanh toán đơn này.', null, 'ORDER_FORBIDDEN');
    return state;
  }

  async function run(work) {
    try { return await repository.withTransaction(work); }
    catch (error) {
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code || error.parent?.code) || error.name === 'SequelizeUniqueConstraintError') {
        throw new HttpError(409, 'Đơn hàng đang được xử lý. Vui lòng tải lại và thử lại.', null, 'PAYMENT_CONFLICT');
      }
      throw error;
    }
  }

  async function prepare(state, transaction) {
    // GET chỉ chuẩn bị WAITING nếu C06 đã chấp nhận và ngân hàng hợp lệ.
    // Snapshot được lưu một lần; không báo chuyển tiền hoặc thay đổi Orders ở GET.
    if (!state.payment && paymentPolicy(state).canReport) {
      const bank = v.bankDetails(state.store), order = state.order;
      state.payment = await repository.createPayment({ OrderId: order.OrderId, PayerId: order.BuyerId, PayeeId: order.SellerId, Amount: order.ProductAmount,
        BankName: bank.bankName, BankAccountSnapshot: bank.accountNumber, BankAccountHolderSnapshot: bank.accountHolder,
        TransferContent: transferContent(order.OrderId), Status: 'WAITING', ProofUrl: null, ReportedAt: null, ConfirmedBy: null, ConfirmedAt: null }, transaction);
    }
  }

  function preview(state) {
    const { order, payment, seller, listing, store } = state;
    // Giao dịch cũ luôn đọc snapshot, tuyệt đối không lấy tài khoản gian hàng mới thay thế.
    const bank = payment ? {
      bankName: payment.BankName, accountNumber: payment.BankAccountSnapshot, accountHolder: payment.BankAccountHolderSnapshot,
    } : v.bankDetails(store);
    return {
      orderId: Number(order.OrderId), listingId: Number(order.ListingId), title: listing?.Title || null,
      seller: { userId: Number(order.SellerId), name: seller?.FullName || null, storeId: store?.StoreId || null, storeName: store?.StoreName || null },
      status: order.Status, paymentId: payment?.PaymentId || null, paymentStatus: payment?.Status || null,
      productAmount: order.ProductAmount, deliveryFee: order.DeliveryFee, totalAmount: order.TotalAmount, sellerAmount: order.ProductAmount,
      bank, transferContent: payment?.TransferContent || transferContent(order.OrderId),
      // Điểm tích hợp C02: chỉ nhận QR theo Orders.SellerId, không dùng QR phí website.
      qr: { sellerId: Number(order.SellerId), storeId: store?.StoreId || null, imageUrl: null },
      proofUrl: payment?.ProofUrl || null, reportedAt: payment?.ReportedAt || null,
      confirmedAt: payment?.ConfirmedAt || null, policy: paymentPolicy(state),
      orderUrl: `/orders/${order.OrderId}/payment`, cancelUrl: `/orders/${order.OrderId}/cancel`,
    };
  }

  const getPaymentInfo = async (orderId, user) => {
    const id = v.validateOrderId(orderId);
    return run(async transaction => {
      const state = await ownedState(id, user, transaction);
      await prepare(state, transaction);
      return preview(state);
    });
  };

  async function reportPayment(orderId, body, file, user) {
    const id = v.validateOrderId(orderId), amount = v.validateNotice(body), extension = v.validateProof(file);
    let saved;
    try {
      return await run(async transaction => {
        const state = await ownedState(id, user, transaction);
        if (amount !== undefined && !v.matchesAmount(amount, state.order.ProductAmount)) throw new HttpError(400, 'Số tiền phải bằng tiền sản phẩm của đơn.', null, 'PAYMENT_AMOUNT_MISMATCH');
        const policy = paymentPolicy(state);
        if (policy.code === 'PAYMENT_REPORTED') return { message: WAITING, data: { ...preview(state), alreadyReported: true } };
        if (!policy.canReport) throw new HttpError(409, policy.message, policy, policy.code);
        await prepare(state, transaction);
        saved = await storage.save(file.buffer, extension);
        const now = clock();
        // D03 không ghi ConfirmedBy/ConfirmedAt, không cập nhật trạng thái Orders.
        const changes = { Status: 'REPORTED', ProofUrl: saved.url, ReportedAt: now };
        if (await repository.reportPayment(state.payment, changes, transaction) !== 1) throw new HttpError(409, 'Giao dịch đã được xử lý. Vui lòng tải lại.', null, 'PAYMENT_CONFLICT');
        await repository.createHistory({ OrderId: id, DeliveryId: null, StatusType: 'PAYMENT', StatusValue: 'REPORTED', Note: `Biên lai: ${saved.url}`, ChangedBy: Number(state.order.BuyerId), CreatedAt: now }, transaction);
        await repository.notifySeller(state.order.SellerId, { type: 'PAYMENT', title: 'Người mua đã báo chuyển tiền', message: `Đơn #${id}: người mua đã gửi biên lai. Vui lòng kiểm tra ngân hàng và xác nhận ở D04.`, referenceType: 'ORDER', referenceId: id, createdAt: now }, transaction);
        state.payment = { ...state.payment, ...changes };
        return { message: successMessage, data: { ...preview(state), alreadyReported: false } };
      });
    } catch (error) {
      if (saved) {
        try { await storage.remove(saved); } catch (cleanupError) { console.error('D03: không xóa được file của transaction thất bại', cleanupError.code); }
      }
      throw error;
    }
  }
  return { getPaymentInfo, reportPayment };
}

module.exports = { ...createPaymentService(), createPaymentService, paymentPolicy };
