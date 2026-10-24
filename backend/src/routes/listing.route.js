const express = require('express');
const { createListing, getAllListingStore, getListingId, updateListing, hiddenListing } = require('../controllers/sellerListing.controller');
const {getAllListing} = require('../controllers/listing.controller');

const router = express.Router();


router.post("/", createListing);
router.get("/store/:StoreId", getAllListingStore);
router.get("/", getAllListing);
router.get("/:ListingId", getListingId);
router.patch("/:ListingId", updateListing);
router.patch("/:ListingId/hidden", hiddenListing);

module.exports = router;