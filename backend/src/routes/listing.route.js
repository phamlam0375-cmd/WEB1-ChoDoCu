const express = require('express');
const { createListing } = require('../controllers/sellerListing.controller');

const router = express.Router();


router.post("/", createListing);

module.exports = router;