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
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < DEFAULT_DURATION_MINUTES
    || durationMinutes % DEFAULT_DURATION_MINUTES !== 0) {
    throw badRequest('Thời lượng tin VIP phải là bội số của 7 ngày.');
  }
  const feeVnd = Number(await settingsService.getSetting('VIP_FEE'));
  if (!Number.isSafeInteger(feeVnd) || feeVnd <= 0 || feeVnd % CREDIT_VALUE_VND !== 0) {
    throw conflict('Cấu hình phí tin VIP không hợp lệ.');
  }
  const durationMultiplier = durationMinutes / DEFAULT_DURATION_MINUTES;
  return {
    durationMinutes,
    feeVnd: feeVnd * durationMultiplier,
    creditUsed: (feeVnd / CREDIT_VALUE_VND) * durationMultiplier,
    baseFeeVnd: feeVnd,
    baseCreditUsed: feeVnd / CREDIT_VALUE_VND,
  };
};

async function refundActivePromotionForSoldListing(listingId, sellerId, now = new Date(), transaction) {
  const promotion = await ListingPromotions.findOne({
    where: {
      ListingId: listingId,
      SellerId: sellerId,
      Status: 'ACTIVE',
      StartsAt: { [Op.lt]: now },
      EndsAt: { [Op.gt]: now },
    },
    transaction,
    lock: transaction?.LOCK.UPDATE,
  });
  if (!promotion) return 0;

  const durationMinutes = Number(promotion.DurationMinutes);
  const creditUsed = Number(promotion.CreditUsed);
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(promotion.EndsAt).getTime() - now.getTime()) / 60000),
  );
  const refundCredit = Number.isSafeInteger(durationMinutes) && durationMinutes > 0
    && Number.isSafeInteger(creditUsed) && creditUsed > 0
    ? Math.floor((creditUsed * remainingMinutes) / durationMinutes)
    : 0;

  await promotion.update({ Status: 'REFUNDED', EndsAt: now }, { transaction });
  if (refundCredit <= 0) return 0;

  const wallet = await UserCredits.findOne({
    where: { UserId: sellerId },
    transaction,
    lock: transaction?.LOCK.UPDATE,
  });
  const currentBalance = wallet ? Number(wallet.Balance) : 0;
  const nextBalance = currentBalance + refundCredit;
  if (wallet) {
    await wallet.update({ Balance: nextBalance }, { transaction });
  } else {
    await UserCredits.create({ UserId: sellerId, Balance: nextBalance }, { transaction });
  }

  await CreditTransactions.create({
    UserId: sellerId,
    PromotionOrderId: promotion.PromotionOrderId,
    Type: 'REFUND',
    Amount: refundCredit,
    BalanceAfter: nextBalance,
    Status: 'SUCCESS',
    ReferenceCode: `SALE-REFUND-${promotion.PromotionId}-${Date.now()}`,
    Note: `Hoàn ${refundCredit} credit VIP còn lại vì tin ${listingId} đã bán.`,
    CompletedAt: now,
  }, { transaction });

  return refundCredit;
}

async function stopPromotion(sellerId, listingId) {
  return sequelize.transaction(async (transaction) => {
    const listing = await getOwnedListing(listingId, sellerId, transaction);
    const refundCredit = await refundActivePromotionForSoldListing(
      listing.ListingId,
      sellerId,
      new Date(),
      transaction,
    );

    if (refundCredit === 0) {
      throw conflict('Tin đăng không có chương trình VIP đang hoạt động.');
    }

    return { listingId: listing.ListingId, refundCredit };
  });
}

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
      Note: `Đẩy tin ${listing.ListingId} lên VIP trong ${cost.durationMinutes / (24 * 60)} ngày`,
      CompletedAt: now,
    }, { transaction });

    const promotion = await ListingPromotions.create({
      ListingId: listing.ListingId,
      SellerId: sellerId,
      PlanName: `CREDIT_VIP_${cost.durationMinutes / (24 * 60)}D`,
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

async function promoteListings(sellerId, listingIds, { idempotencyKey, durationMinutes } = {}) {
  const cost = await getVipCost(durationMinutes || DEFAULT_DURATION_MINUTES);
  const ids = [...new Set((Array.isArray(listingIds) ? listingIds : []).map(Number))];
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw badRequest('Danh sách tin đăng không hợp lệ.');
  }
  const normalizedKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';

  return sequelize.transaction(async (transaction) => {
    if (normalizedKey) {
      const existing = await PromotionOrders.findOne({
        where: { BuyerId: sellerId, IdempotencyKey: normalizedKey },
        include: [{ model: ListingPromotions, as: 'items' }],
        transaction,
      });
      if (existing) return existing;
    }

    const now = new Date();
    const listings = [];
    for (const listingId of ids) {
      const listing = await getOwnedListing(listingId, sellerId, transaction);
      if (listing.Status !== 'ACTIVE') throw conflict(`Tin "${listing.Title}" chưa ở trạng thái hoạt động.`);
      const active = await ListingPromotions.findOne({
        where: { ListingId: listingId, Status: 'ACTIVE', EndsAt: { [Op.gt]: now } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (active) throw conflict(`Tin "${listing.Title}" đang ở trạng thái VIP.`);
      listings.push(listing);
    }

    const totalCredit = cost.creditUsed * listings.length;
    const wallet = await UserCredits.findOne({
      where: { UserId: sellerId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const balance = wallet ? Number(wallet.Balance) : 0;
    if (balance < totalCredit) throw conflict(`Số dư không đủ. Cần ${totalCredit} credit.`);

    const order = await PromotionOrders.create({
      BuyerId: sellerId,
      ListingCount: listings.length,
      DurationMinutes: cost.durationMinutes,
      TotalCredit: totalCredit,
      Status: 'PAID',
      IdempotencyKey: normalizedKey || null,
      PaidAt: now,
    }, { transaction });

    const nextBalance = balance - totalCredit;
    if (wallet) await wallet.update({ Balance: nextBalance }, { transaction });
    else await UserCredits.create({ UserId: sellerId, Balance: nextBalance }, { transaction });

    await CreditTransactions.create({
      UserId: sellerId,
      PromotionOrderId: order.PromotionOrderId,
      Type: 'SPEND',
      Amount: -totalCredit,
      BalanceAfter: nextBalance,
      MoneyAmount: cost.feeVnd * listings.length,
      Status: 'SUCCESS',
      ReferenceCode: `PROMO-${order.PromotionOrderId}`,
      IdempotencyKey: normalizedKey || null,
      Note: `Đẩy ${listings.length} tin lên VIP trong 7 ngày`,
      CompletedAt: now,
    }, { transaction });

    await ListingPromotions.bulkCreate(listings.map((listing) => ({
      ListingId: listing.ListingId,
      SellerId: sellerId,
      PlanName: `CREDIT_VIP_${cost.durationMinutes / (24 * 60)}D`,
      FeeAmount: 0,
      PaymentReference: `PROMO-${order.PromotionOrderId}`,
      Status: 'ACTIVE',
      StartsAt: now,
      EndsAt: new Date(now.getTime() + cost.durationMinutes * 60 * 1000),
      ConfirmedAt: now,
      PromotionOrderId: order.PromotionOrderId,
      CreditUsed: cost.creditUsed,
      DurationMinutes: cost.durationMinutes,
    })), { transaction });

    return { order, balance: nextBalance, creditUsed: totalCredit };
  });
}

module.exports = {
  listSellerPromotions,
  getVipStatus,
  promoteListing,
  promoteListings,
  refundActivePromotionForSoldListing,
  stopPromotion,
};
