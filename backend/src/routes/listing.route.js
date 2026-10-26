const express = require('express');
const { createListing, getAllListingStore, getListingId, updateListing, hiddenListing } = require('../controllers/sellerListing.controller');
const { getAllListing } = require('../controllers/listing.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const uploadListing = require('../middlewares/upload/listingUpload');

const router = express.Router();


router.post("/", requireAuth, uploadListing.array("images", 5), createListing);
router.get("/store/:StoreId", getAllListingStore);
router.get("/", getAllListing);
router.get("/:ListingId", getListingId);
router.patch("/:ListingId", requireAuth, updateListing);
router.patch("/:ListingId/hidden", requireAuth, hiddenListing);

module.exports = router;