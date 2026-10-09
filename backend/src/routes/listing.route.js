const express = require('express');
const { createListing, getAllListing, getListingId } = require('../controllers/sellerListing.controller');

const router = express.Router();


router.post("/", createListing);
router.get("/store/:storeId", getAllListing);
router.get("/:listingId", getListingId);

module.exports = router;