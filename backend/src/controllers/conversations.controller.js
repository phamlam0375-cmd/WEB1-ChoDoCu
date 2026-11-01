'use strict';

const conversationService = require('../services/conversations.service');
const { badRequest, forbidden } = require('../utils/httpError');

const sendMessage = async (req, res, next) => {
    try {
        const message = await conversationService.sendMessage({
            conversationId: Number(req.params.id),
            senderId: req.user.UserId,
            content: req.body.content,
            messageType: req.body.messageType,
            attachmentUrl: req.body.attachmentUrl
        });
        res.status(201).json(message);
    } catch (err) {
        next(err)
    }
};

const getMessage = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id)
        const result = await conversationService.getMessages({
            conversationId,
            userId: req.user.UserId,
            limit: req.query.limit,
            before: req.query.before
        });
        res.json(result)
    }
    catch (err) {
        next(err);
    }
}

module.exports = { sendMessage, getMessage };