'use strict';

const { sequelize, Orders, Deliveries, Reviews, Users } = require('../models');
const { badRequest, conflict, notFound, forbidden } = require('../utils/httpError');

const TARGET_TYPES = ['SELLER', 'DRIVER'];
const completedOrder = ['COMPLETED'];

function normalizeTargetType(value) {
    const targetType = String(value || '').trim().toUpperCase();
    if (!TARGET_TYPES.includes(targetType)) throw badRequest('Đối tượng đánh giá không hợp lệ');
    return targetType;
}

function normalizeRating(value) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw badRequest('Điểm đánh giá phải từ 1 đến 5');
    }
    return rating;
}

function normalizeComment(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > 1000) {
        throw badRequest('Nội dung đánh giá tối đa 1000 ký tự');
    }
    return value.trim();
}

async function getOrderForReview(orderId, userId, transaction) {
    const order = await Orders.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw notFound('Không tìm thấy đơn hàng');
    if (order.Status !== 'COMPLETED' || !order.CompletedAt) {
        throw conflict('Chỉ được đánh giá sau khi đơn hàng hoàn tất');
    }
    if (Number(order.BuyerId) !== userId) {
        throw forbidden('Chỉ người mua của đơn mới được đánh giá');
    }
    return order;
}

async function createReview(orderId, buyerId, input) {
    const targetType = normalizeTargetType(input.targetType);
    const rating = normalizeRating(input.rating);
    const comment = normalizeComment(input.comment);

    return sequelize.transaction(async (transaction) => {
        const order = await getOrderForReview(orderId, buyerId, transaction);
        let targetUserId = Number(order.SellerId);
        if (targetType === 'DRIVER') {
            const delivery = await Deliveries.findOne({ where: { OrderId: orderId }, transaction });
            if (!delivery || !delivery.DriverId) throw conflict('Đơn hàng chưa có đối tác giao hàng');
            targetUserId = Number(delivery.DriverId);
        }

        const existing = await Reviews.findOne({
            where: { OrderId: orderId, ReviewerId: buyerId, TargetType: targetType },
            transaction
        });
        if (existing) throw conflict(`Bạn đã đánh giá ${targetType === 'SELLER' ? 'người bán' : 'đối tác giao hàng'} cho đơn này`);

        try {
            return await Reviews.create({
                OrderId: orderId,
                ReviewerId: buyerId,
                TargetUserId: targetUserId,
                TargetType: targetType,
                Rating: rating,
                Comment: comment
            }, { transaction });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                throw conflict('Bạn đã đánh giá đối tượng này cho đơn hàng');
            }
            throw error;
        }
    });
}

async function listOrderReviews(orderId, userId) {
    const order = await Orders.findByPk(orderId);
    if (!order) throw notFound('Không tìm thấy đơn hàng');
    const allowed = [order.BuyerId, order.SellerId].map(Number);
    const delivery = await Deliveries.findOne({ where: { OrderId: orderId }, attributes: ['DriverId'] });
    if (delivery?.DriverId) allowed.push(Number(delivery.DriverId));
    if (!allowed.includes(userId)) throw forbidden('Bạn không có quyền xem đánh giá của đơn này');

    return Reviews.findAll({
        where: { OrderId: orderId },
        include: [
            { model: Users, as: 'reviewer', attributes: ['UserId', 'FullName', 'AvatarUrl'] },
            { model: Users, as: 'target', attributes: ['UserId', 'FullName', 'AvatarUrl'] }
        ],
        order: [['CreatedAt', 'ASC']]
    });
}

async function replyReview(reviewId, userId, reply) {
    const normalizedReply = normalizeComment(reply);
    if (!normalizedReply) throw badRequest('Vui lòng nhập nội dung phản hồi');

    const review = await Reviews.findByPk(reviewId);
    if (!review) throw notFound('Không tìm thấy đánh giá');
    if (Number(review.TargetUserId) !== userId) {
        throw forbidden('Chỉ đối tác được đánh giá mới được phản hồi');
    }
    if (review.ReplyAt) throw conflict('Đánh giá này đã có phản hồi');

    await review.update({ Reply: normalizedReply, ReplyAt: new Date() });
    return review;
}

module.exports = { createReview, listOrderReviews, replyReview };
