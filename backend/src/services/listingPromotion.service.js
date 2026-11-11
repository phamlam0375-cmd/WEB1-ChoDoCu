'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  Listings,
  ListingPromotions,
  PromotionOrders,
  CreditTransactions,
  UserCredits,
} = require('../models');
const settingsService = require('./settings.service');
const { badRequest, conflict, forbidden, notFound } = require('../utils/httpError');

const DEFAULT_DURATION_MINUTES = 7 * 24 * 60;
const CREDIT_VALUE_VND = 1000;

const getOwnedListing = async (listingId, sellerId, transaction) => {
  const listing = await Listings.findOne({
    where: { ListingId: listingId },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!listing) throw notFound('Không tìm thấy tin đăng.');
  if (Number(listing.SellerId) !== Number(sellerId)) {
    throw forbidden('Bạn không có quyền đẩy tin đăng này lên VIP.');
  }
  return listing;
};

const getVipCost = async (durationMinutes = DEFAULT_DURATION_MINUTES) => {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes !== DEFAULT_DURATION_MINUTES) {
    throw badRequest('Thời lượng tin VIP hiện chỉ hỗ trợ 7 ngày.');
  }
  const feeVnd = Number(await settingsService.getSetting('VIP_FEE'));
  if (!Number.isSafeInteger(feeVnd) || feeVnd <= 0 || feeVnd % CREDIT_VALUE_VND !== 0) {
    throw conflict('Cấu hình phí tin VIP không hợp lệ.');
  }
  return {
    durationMinutes,
    feeVnd,
    creditUsed: feeVnd / CREDIT_VALUE_VND,
  };
};

async function listSellerPromotions(sellerId) {
  const now = new Date();
  const [promotions, wallet, cost] = await Promise.all([
    ListingPromotions.findAll({
      where: {
        SellerId: sellerId,
        Status: 'ACTIVE',
        EndsAt: { [Op.gt]: now },
      },
      include: [{ model: Listings, as: 'Listing', attributes: ['ListingId', 'Title', 'Status'] }],
      order: [['EndsAt', 'ASC']],
    }),
    UserCredits.findOne({ where: { UserId: sellerId } }),
    getVipCost(),
  ]);
  return {
    promotions,
    balance: wallet ? Number(wallet.Balance) : 0,
    ...cost,
  };
}

async function getVipStatus(sellerId, listingId) {
  await getOwnedListing(listingId, sellerId);
  const now = new Date();
  const promotion = await ListingPromotions.findOne({
    where: {
      ListingId: listingId,
      Status: 'ACTIVE',
      StartsAt: { [Op.lte]: now },
      EndsAt: { [Op.gt]: now },
    },
    order: [['EndsAt', 'DESC']],
  });
  const wallet = await UserCredits.findOne({ where: { UserId: sellerId } });
  const cost = await getVipCost();
  return {
    isVip: Boolean(promotion),
    promotion,
    balance: wallet ? Number(wallet.Balance) : 0,
    ...cost,
  };
}

async function promoteListing(sellerId, listingId, { idempotencyKey, durationMinutes } = {}) {
  const cost = await getVipCost(durationMinutes || DEFAULT_DURATION_MINUTES);
  const normalizedKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (normalizedKey && normalizedKey.length > 100) {
    throw badRequest('Idempotency key không được vượt quá 100 ký tự.');
  }

  return sequelize.transaction(async (transaction) => {
    if (normalizedKey) {
      const existing = await PromotionOrders.findOne({
        where: { BuyerId: sellerId, IdempotencyKey: normalizedKey },
        include: [{ model: ListingPromotions, as: 'items' }],
        transaction,
      });
      if (existing) return existing;
    }

    const listing = await getOwnedListing(listingId, sellerId, transaction);
    if (listing.Status !== 'ACTIVE') {
      throw conflict('Chỉ có thể đẩy tin đang hoạt động lên VIP.');
    }

    const now = new Date();
    const activePromotion = await ListingPromotions.findOne({
      where: {
        ListingId: listingId,
        Status: 'ACTIVE',
        EndsAt: { [Op.gt]: now },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (activePromotion) throw conflict('Tin đăng đang ở trạng thái VIP.');

    const wallet = await UserCredits.findOne({
      where: { UserId: sellerId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const balance = wallet ? Number(wallet.Balance) : 0;
    if (balance < cost.creditUsed) {
      throw conflict(`Số dư không đủ. Cần ${cost.creditUsed} credit.`);
    }

    const order = await PromotionOrders.create({
      BuyerId: sellerId,
      ListingCount: 1,
      DurationMinutes: cost.durationMinutes,
      TotalCredit: cost.creditUsed,
      Status: 'PAID',
      IdempotencyKey: normalizedKey || null,
      PaidAt: now,
    }, { transaction });

    const nextBalance = balance - cost.creditUsed;
    if (wallet) {
      await wallet.update({ Balance: nextBalance }, { transaction });
    } else {
      await UserCredits.create({ UserId: sellerId, Balance: nextBalance }, { transaction });
    }

    const creditTransaction = await CreditTransactions.create({
      UserId: sellerId,
      PromotionOrderId: order.PromotionOrderId,
      Type: 'SPEND',
      Amount: -cost.creditUsed,
      BalanceAfter: nextBalance,
      MoneyAmount: cost.feeVnd,
      Status: 'SUCCESS',
      ReferenceCode: `PROMO-${order.PromotionOrderId}`,
      IdempotencyKey: normalizedKey || null,
      Note: `Đẩy tin ${listing.ListingId} lên VIP trong 7 ngày`,
      CompletedAt: now,
    }, { transaction });

    const promotion = await ListingPromotions.create({
      ListingId: listing.ListingId,
      SellerId: sellerId,
      PlanName: 'CREDIT_VIP_7D',
      FeeAmount: 0,
      PaymentReference: creditTransaction.ReferenceCode,
      Status: 'ACTIVE',
      StartsAt: now,
      EndsAt: new Date(now.getTime() + cost.durationMinutes * 60 * 1000),
      ConfirmedAt: now,
      PromotionOrderId: order.PromotionOrderId,
      CreditUsed: cost.creditUsed,
      DurationMinutes: cost.durationMinutes,
    }, { transaction });

    return {
      order,
      promotion,
      balance: nextBalance,
      creditUsed: cost.creditUsed,
    };
  });
}

module.exports = { listSellerPromotions, getVipStatus, promoteListing };
