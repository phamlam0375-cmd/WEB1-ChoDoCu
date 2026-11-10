const express = require('express');
const { createDelivery } = require('../controllers/preparation.controller');
const { requireTokenAuth } = require('../middlewares/auth.middleware');

const router = express.Router();


router.post("/:id/preparation", requireTokenAuth, createDelivery);

module.exports = router;
