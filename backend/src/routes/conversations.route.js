const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { sendMessage, getMessage } = require('../controllers/conversations.controller');

const router = express.Router();


router.post("/:id/messages", requireAuth, sendMessage);
router.get("/:id/messages", requireAuth, getMessage);

module.exports = router;