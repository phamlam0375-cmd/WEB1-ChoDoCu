'use strict';

const promotionService = require('../services/listingPromotion.service');

const promoteListings = async (req, res) => {
  try {
    const data = await promotionService.promoteListings(
      req.user.UserId,
      req.body.listingIds,
      {
        idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey,
        durationMinutes: req.body.durationMinutes ? Number(req.body.durationMinutes) : undefined,
      },
    );
    return res.status(201).json({ success: true, message: 'Đẩy các tin lên VIP thành công.', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không thể đẩy các tin lên VIP.' });
  }
};

const listSellerPromotions = async (req, res) => {
  try {
    const data = await promotionService.listSellerPromotions(req.user.UserId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không thể lấy danh sách tin VIP.' });
  }
};

const getVipStatus = async (req, res) => {
  try {
    const data = await promotionService.getVipStatus(req.user.UserId, Number(req.params.ListingId));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không thể lấy trạng thái VIP.' });
  }
};

const promoteListing = async (req, res) => {
  try {
    const data = await promotionService.promoteListing(
      req.user.UserId,
      Number(req.params.ListingId),
      {
        idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey,
        durationMinutes: req.body.durationMinutes ? Number(req.body.durationMinutes) : undefined,
      }
    );
    return res.status(201).json({ success: true, message: 'Đẩy tin lên VIP thành công.', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không thể đẩy tin lên VIP.' });
  }
};

const stopPromotion = async (req, res) => {
  try {
    const data = await promotionService.stopPromotion(
      req.user.UserId,
      Number(req.params.ListingId),
    );
    return res.json({ success: true, message: 'Đã dừng tin VIP và hoàn Credit còn lại.', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không thể dừng tin VIP.' });
  }
};

module.exports = {
  listSellerPromotions,
  getVipStatus,
  promoteListing,
  promoteListings,
  stopPromotion,
};
