const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { sendMessage } = require('../controllers/conversations.controller');

const router = express.Router();


router.post("/conversations/:conversationsId/messages", requireAuth, sendMessage);

module.exports = router;