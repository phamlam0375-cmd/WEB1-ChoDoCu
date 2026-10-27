const express = require('express');
const { createDelivery } = require('../controllers/preparation.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();


router.post("/:id/preparation", requireAuth, createDelivery);

module.exports = router;