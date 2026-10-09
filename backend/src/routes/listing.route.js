const express = require('express');
const { createListing, getAllListing } = require('../controllers/sellerListing.controller');

const router = express.Router();


router.post("/", createListing);
router.get("/:sellerId", getAllListing);

module.exports = router;