'use strict';

const { HttpError } = require('../utils/httpError');
const orderConfig = require('../config/order.config');
const defaultDeliveryFeeService = require('./deliveryFee.service');
const defaultRepository = require('../repositories/order.repository');
const { validateCreateOrder } = require('../validators/order.validator');
const { addMoney, asApiNumber } = require('../utils/money');

const EXPIRED_REASON = 'Hết thời gian giữ sản phẩm.';

function orderError(status, code, message, errors) {
  return new HttpError(status, message, errors, code);
}

function formatVietnameseDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(date);
}

function normalizeQuote(quote, now) {
  if (!quote || quote.amount === undefined || quote.amount === null) {
    throw orderError(422, 'DELIVERY_QUOTE_REQUIRED', 'Vui lòng tính phí giao hàng trước khi đặt.');
  }
  const expiresAt = new Date(quote.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw orderError(422, 'DELIVERY_QUOTE_EXPIRED', 'Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.');
  }
  const deliveryFeeRuleId = Number(quote.deliveryFeeRuleId);
  if (!Number.isSafeInteger(deliveryFeeRuleId) || deliveryFeeRuleId <= 0) {
    throw orderError(422, 'DELIVERY_QUOTE_INVALID', 'Báo giá giao hàng không hợp lệ.');
  }
  return { amount: String(quote.amount), deliveryFeeRuleId };
}

function createOrderService({
  repository = defaultRepository,
  deliveryFeeService = defaultDeliveryFeeService,
  config = orderConfig,
  clock = () => new Date()
} = {}) {
  async function getOrderPreview(listingId, buyer) {
    const normalizedListingId = Number(listingId);
    if (!Number.isSafeInteger(normalizedListingId) || normalizedListingId <= 0) {
      throw orderError(400, 'VALIDATION_ERROR', 'Mã sản phẩm không hợp lệ.');
    }
    const listing = await repository.findListingPreview(normalizedListingId);
    if (!listing) throw orderError(404, 'LISTING_NOT_FOUND', 'Không tìm thấy sản phẩm.');

    return {
      listing: {
        listingId: Number(listing.ListingId),
        sellerId: Number(listing.SellerId),
        title: listing.Title,
        description: listing.Description,
        price: asApiNumber(listing.Price),
        condition: listing.ConditionLevel,
        location: listing.Location,
        status: listing.Status,
        imageUrl: listing.ImageUrl,
        seller: { name: listing.SellerName, verified: Boolean(listing.SellerVerified) },
        isOwnListing: Number(listing.SellerId) === Number(buyer.UserId),
        isAvailable: listing.Status === 'ACTIVE'
      },
      buyer: {
        fullName: buyer.FullName || '',
        phone: buyer.Phone || '',
        address: buyer.Address || ''
      },
      reservationMinutes: config.reservationMinutes,
      delivery: deliveryFeeService.getCapability()
    };
  }

  async function createOrder(payload, buyerId) {
    const data = validateCreateOrder(payload);
    const normalizedBuyerId = Number(buyerId);
    if (!Number.isSafeInteger(normalizedBuyerId) || normalizedBuyerId <= 0) {
      throw orderError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
    }

    try {
      return await repository.withTransaction(async (transaction) => {
        const now = clock();
        const listing = await repository.findListingByIdForUpdate(data.listingId, transaction);
        if (!listing) throw orderError(404, 'LISTING_NOT_FOUND', 'Không tìm thấy sản phẩm.');
        if (Number(listing.SellerId) === normalizedBuyerId) {
          throw orderError(403, 'CANNOT_BUY_OWN_LISTING', 'Bạn không thể mua sản phẩm của chính mình.');
        }
        if (listing.Status !== 'ACTIVE') {
          throw orderError(409, 'LISTING_UNAVAILABLE', 'Sản phẩm hiện không còn khả dụng.');
        }

        let deliveryFee = '0.00';
        let deliveryFeeRuleId = null;
        if (data.deliveryMethod === 'DELIVERY') {
          const quote = normalizeQuote(await deliveryFeeService.verifyQuote({
            quoteId: data.deliveryQuoteId,
            receiverAddress: data.receiverAddress,
            listing,
            buyerId: normalizedBuyerId,
            transaction
          }), now);
          deliveryFee = quote.amount;
          deliveryFeeRuleId = quote.deliveryFeeRuleId;
        }

        const productAmount = String(listing.Price);
        let totalAmount;
        try {
          totalAmount = addMoney(productAmount, deliveryFee);
        } catch (_error) {
          throw orderError(500, 'INVALID_MONEY_VALUE', 'Không thể tính tổng thanh toán.');
        }

        const reservedUntil = new Date(now.getTime() + config.reservationMinutes * 60 * 1000);
        if (await repository.reserveListing(data.listingId, transaction) !== 1) {
          throw orderError(409, 'RESERVATION_CONFLICT', 'Sản phẩm hiện không còn khả dụng.');
        }

        const order = await repository.createOrder({
          BuyerId: normalizedBuyerId,
          ListingId: data.listingId,
          SellerId: Number(listing.SellerId),
          DeliveryMethod: data.deliveryMethod,
          DeliveryFeeRuleId: deliveryFeeRuleId,
          ReceiverName: data.receiverName,
          ReceiverPhone: data.receiverPhone,
          ReceiverAddress: data.receiverAddress,
          BuyerNote: data.note,
          ProductAmount: productAmount,
          DeliveryFee: deliveryFee,
          CommissionRate: config.commissionRate,
          TotalAmount: totalAmount,
          Status: 'RESERVED',
          ReservedUntil: reservedUntil,
          CancelReason: null,
          CreatedAt: now,
          CompletedAt: null
        }, transaction);

        const orderId = Number(order.OrderId);
        await repository.createHistory({
          OrderId: orderId,
          DeliveryId: null,
          StatusType: 'ORDER',
          StatusValue: 'RESERVED',
          Note: 'Người mua đặt hàng và giữ sản phẩm.',
          ChangedBy: normalizedBuyerId,
          CreatedAt: now
        }, transaction);
        await repository.createNotification({
          userId: Number(listing.SellerId),
          type: 'ORDER',
          title: 'Có đơn hàng mới',
          message: `Sản phẩm ${listing.Title} đã được giữ đến ${formatVietnameseDate(reservedUntil)}.`,
          referenceType: 'ORDER',
          referenceId: orderId
        }, transaction);

        return {
          message: `Đã giữ sản phẩm đến ${formatVietnameseDate(reservedUntil)}.`,
          data: {
            orderId,
            listingId: data.listingId,
            status: 'RESERVED',
            deliveryMethod: data.deliveryMethod,
            productAmount: asApiNumber(productAmount),
            deliveryFee: asApiNumber(deliveryFee),
            totalAmount: asApiNumber(totalAmount),
            reservedUntil: reservedUntil.toISOString()
          }
        };
      });
    } catch (error) {
      const code = error.original?.code || error.parent?.code;
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) {
        throw orderError(409, 'RESERVATION_CONFLICT', 'Sản phẩm vừa được người khác giữ.');
      }
      throw error;
    }
  }

  async function expireReservations() {
    const now = clock();
    return repository.withTransaction(async (transaction) => {
      const expiredOrders = await repository.findExpiredReservations(
        now, config.expirationBatchSize, transaction
      );
      let expiredCount = 0;
      for (const order of expiredOrders) {
        const updated = await repository.cancelExpiredOrder(
          order.OrderId, now, EXPIRED_REASON, transaction
        );
        if (updated !== 1) continue;

        await repository.reopenListing(order.ListingId, transaction);
        await repository.createHistory({
          OrderId: order.OrderId,
          DeliveryId: null,
          StatusType: 'ORDER',
          StatusValue: 'CANCELLED',
          Note: EXPIRED_REASON,
          ChangedBy: null,
          CreatedAt: now
        }, transaction);
        const message = `Đơn #${order.OrderId} đã tự hủy do hết thời gian giữ sản phẩm.`;
        for (const userId of [order.BuyerId, order.SellerId]) {
          await repository.createNotification({
            userId,
            type: 'ORDER',
            title: 'Đơn hàng đã hết thời gian giữ',
            message,
            referenceType: 'ORDER',
            referenceId: order.OrderId
          }, transaction);
        }
        expiredCount += 1;
      }
      return { expiredCount };
    });
  }

  return { createOrder, expireReservations, getOrderPreview };
}

const service = createOrderService();
module.exports = {
  EXPIRED_REASON,
  createOrder: service.createOrder,
  createOrderService,
  expireReservations: service.expireReservations,
  getOrderPreview: service.getOrderPreview
};
