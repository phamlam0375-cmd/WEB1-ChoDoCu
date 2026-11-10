'use strict';

const reviewService = require('../services/review.service');

const createReview = async (req, res) => {
    const data = await reviewService.createReview(
        Number(req.params.orderId),
        req.user.UserId,
        req.body
    );
    return res.status(201).json({ success: true, data });
};

const listOrderReviews = async (req, res) => {
    const data = await reviewService.listOrderReviews(Number(req.params.orderId), req.user.UserId);
    return res.json({ success: true, data });
};

const replyReview = async (req, res) => {
    const data = await reviewService.replyReview(
        Number(req.params.reviewId),
        req.user.UserId,
        req.body.reply
    );
    return res.json({ success: true, data });
};

module.exports = { createReview, listOrderReviews, replyReview };
