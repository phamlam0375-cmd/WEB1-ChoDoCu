'use strict';

const { sequelize, Listings, Conversations, ConversationParticipants, Messages } = require('../models');
const {
    notFound,
    badRequest,
    forbidden,
    conflict
} = require("../utils/httpError");

//check user co thuoc trong chat khong
const assertPaticipant = async (conversionId, userId) => {
    const participant = await ConversationParticipants.findOne({
        where: {
            ConversationsId: conversionId,
            UserId: userId
        }
    })
    if (!participant) {
        throw forbidden("Bạn không thuộc hội thoại này");
    }
}

const sendMessage = async ({ conversionId, senderId, content, messageType = 'TEXT', attachmentUrl = null }) => {
    await assertPaticipant(conversionId, senderId);

    const text = (content || '').trim();
    if (messageType === 'TEXT' && !text) throw badRequest('Nội dung tin nhắn trống');
    if (messageType === 'IMAGE' && !attachmentUrl) throw badRequest('Thiếu ảnh đính kèm');
    if (text.length > 2000) throw badRequest('Tin nhắn quá dài');

    return sequelize.transaction(async (transaction) => {
        const message = await Messages.create({
            ConversationsId: conversionId,
            SenderId: senderId,
            Content: content,
            Context: text || null,
            MessageType: messageType,
            AttachmentUrl: attachmentUrl
        }, { transaction })

        await Conversations.update(
            { LastMessageAt: message.SendAt },
            { where: { ConversationsId: conversionId }, transaction },
        )

        await ConversationParticipants.update(
            { LastMessageId: message.MessagesId },
            { where: { ConversationsId: conversionId, UserId: userId }, transaction }
        )
        return message;
    })
}

module.exportss = { sendMessage }