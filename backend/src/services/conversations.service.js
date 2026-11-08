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

const getUserConversations = async ({ userId }) => {
    // 1. Tìm tất cả ConversationId mà user này tham gia
    const userMemberships = await ConversationParticipants.findAll({
        where: { UserId: userId },
        attributes: ['ConversationId', 'LastReadMessageId', 'JoinedAt', 'IsMuted'],
    });

    if (!userMemberships || userMemberships.length === 0) {
        return [];
    }

    const conversationIds = userMemberships.map((m) => m.ConversationId);
    const membershipMap = new Map(
        userMemberships.map((m) => [m.ConversationId, m])
    );

    // 2. Lấy thông tin Conversations cùng với Participants (kèm Users)
    const conversations = await Conversations.findAll({
        where: {
            ConversationId: {
                [Op.in]: conversationIds,
            },
        },
        include: [
            {
                model: ConversationParticipants,
                as: 'Participants',
                include: [
                    {
                        model: require('../models').Users,
                        as: 'User',
                        attributes: ['UserId', 'Username', 'FullName', 'AvatarUrl'],
                    },
                ],
            },
        ],
        order: [
            ['LastMessageAt', 'DESC'],
            ['CreatedAt', 'DESC'],
        ],
    });

    // 3. Lấy tin nhắn mới nhất của từng conversation
    const latestMessages = await Promise.all(
        conversationIds.map((cId) =>
            Messages.findOne({
                where: { ConversationId: cId },
                order: [['MessageId', 'DESC']],
            })
        )
    );

    const messageMap = new Map();
    latestMessages.forEach((msg) => {
        if (msg) messageMap.set(msg.ConversationId, msg);
    });

    // 4. Định dạng dữ liệu trả về
    return conversations.map((conv) => {
        const plain = conv.toJSON();
        const myMembership = membershipMap.get(conv.ConversationId);
        const lastMessage = messageMap.get(conv.ConversationId) || null;

        // Xác định đối phương (other participant)
        const otherParticipants = (plain.Participants || [])
            .filter((p) => Number(p.UserId) !== Number(userId))
            .map((p) => p.User);

        // Kiểm tra xem có tin nhắn chưa đọc không
        const isUnread =
            Boolean(lastMessage) &&
            Number(lastMessage.SenderId) !== Number(userId) &&
            (!myMembership?.LastReadMessageId ||
                Number(lastMessage.MessageId) > Number(myMembership.LastReadMessageId));

        return {
            ConversationId: plain.ConversationId,
            ConversationType: plain.ConversationType,
            ListingId: plain.ListingId,
            OrderId: plain.OrderId,
            CreatedAt: plain.CreatedAt,
            LastMessageAt: plain.LastMessageAt,
            MyMembership: {
                JoinedAt: myMembership?.JoinedAt,
                LastReadMessageId: myMembership?.LastReadMessageId,
                IsMuted: myMembership?.IsMuted,
            },
            OtherUser: otherParticipants[0] || null,
            OtherParticipants: otherParticipants,
            LastMessage: lastMessage,
            IsUnread: isUnread,
        };
    });
};

module.exports = { sendMessage, getMessages, getUserConversations }