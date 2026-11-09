'use strict';

const conversationService = require('../services/conversations.service');
const { badRequest, forbidden } = require('../utils/httpError');

const sendMessage = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        const message = await conversationService.sendMessage({
            conversationId,
            senderId: req.user.UserId,
            content: req.body.content,
            messageType: req.body.messageType,
            attachmentUrl: req.body.attachmentUrl
        });

        // Phát sự kiện realtime tới tất cả client đang trong room này
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${conversationId}`).emit('new_message', message);
            // Phát thông báo cập nhật danh sách hội thoại
            io.emit('conversation_updated', {
                conversationId,
                lastMessage: message,
            });
        }

        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
};

const getMessageId = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        const result = await conversationService.getMessages({
            conversationId,
            userId: req.user.UserId,
            limit: req.query.limit,
            before: req.query.before
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
};

const getConversations = async (req, res, next) => {
    try {
        const conversations = await conversationService.getUserConversations({
            userId: req.user.UserId,
        });
        res.json({
            success: true,
            data: conversations,
        });
    } catch (err) {
        next(err);
    }
};

const createListingConversation = async (req, res, next) => {
    try {
        const listingId = Number(req.body.listingId);
        if (!listingId) {
            throw badRequest('Thiếu listingId');
        }

        const conversation = await conversationService.getOrCreateListingConversation({
            listingId,
            buyerId: req.user.UserId,
        });

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    sendMessage,
    getMessageId,
    getConversations,
    createListingConversation,
};
