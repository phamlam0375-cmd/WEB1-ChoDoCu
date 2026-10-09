const express = require('express');
const { createListing, getAllListing, getListingId, updateListing, hiddenListing } = require('../controllers/sellerListing.controller');

const router = express.Router();


router.post("/", createListing);
router.get("/store/:StoreId", getAllListing);
router.get("/:ListingId", getListingId);
router.patch("/:ListingId", updateListing);
router.patch("/:ListingId/hidden", hiddenListing);

module.exports = router;