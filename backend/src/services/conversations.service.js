'use strict';

const { sequelize, Conversations, ConversationParticipants, Messages } = require('../models');
const { badRequest, forbidden } = require('../utils/httpError');
const { Op } = require('sequelize');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

//check user co thuoc trong chat khong
const assertPaticipant = async (conversationId, userId) => {
    const participant = await ConversationParticipants.findOne({
        where: {
            ConversationId: conversationId,
            UserId: userId
        }
    })
    if (!participant) {
        throw forbidden("Bạn không thuộc hội thoại này");
    }
}

const sendMessage = async ({ conversationId, senderId, content, messageType = 'TEXT', attachmentUrl = null }) => {
    await assertPaticipant(conversationId, senderId);

    const text = (content || '').trim();
    if (messageType === 'TEXT' && !text) throw badRequest('Nội dung tin nhắn trống');
    if (messageType === 'IMAGE' && !attachmentUrl) throw badRequest('Thiếu ảnh đính kèm');
    if (text.length > 2000) throw badRequest('Tin nhắn quá dài');

    return sequelize.transaction(async (transaction) => {
        const message = await Messages.create({
            ConversationId: conversationId,
            SenderId: senderId,
            SenderType: 'USER',
            Content: text || null,
            MessageType: messageType,
            AttachmentUrl: attachmentUrl
        }, { transaction })

        await Conversations.update(
            { LastMessageAt: message.SentAt },
            { where: { ConversationId: conversationId }, transaction },
        )

        await ConversationParticipants.update(
            { LastReadMessageId: message.MessageId },
            { where: { ConversationId: conversationId, UserId: senderId }, transaction }
        )
        return message;
    })
}

const getMessages = async ({ conversationId, userId, limit, before }) => {
    await assertPaticipant(conversationId, userId);

    const take = Math.min(
        Math.max(Number(limit) || DEFAULT_LIMIT, 1),
        MAX_LIMIT
    )
    const where = { ConversationId: conversationId };
    if (Number(before))
        where.MessageId = {
            [Op.lt]: Number(before)
        }

    const rows = await Messages.findAll({
        where,
        order: [['MessageId', 'DESC']],
        limit: take + 1
    })

    const hasMore = rows.length > take;
    const message = rows.slice(0, take).reverse();
    const nextCursor = hasMore ? message[0].MessageId : null;

    return { message, hasMore, nextCursor };
}

module.exports = { sendMessage, getMessages }