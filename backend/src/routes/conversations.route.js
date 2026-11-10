const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const {
    sendMessage,
    getMessageId,
    getConversations,
    createListingConversation,
} = require('../controllers/conversations.controller');

const router = express.Router();

// Lấy danh sách tất cả cuộc hội thoại của user hiện tại
router.get('/', requireAuth, getConversations);

// Bắt đầu hoặc lấy hội thoại theo ListingId
router.post('/listing', requireAuth, createListingConversation);

// Gửi tin nhắn và lấy tin nhắn theo conversationId
router.post('/:id/messages', requireAuth, sendMessage);
router.get('/:id/messages', requireAuth, getMessageId);

module.exports = router;
