const { searchListings } = require('../controllers/search.controller');
const express = require('express');
const { createListing, getAllListingStore, getListingId, updateListing, hiddenListing } = require('../controllers/sellerListing.controller');
const { getAllListing } = require('../controllers/listing.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const promotionController = require('../controllers/listingPromotion.controller');
const uploadListing = require('../middlewares/upload/listingUpload');

const router = express.Router();


router.post("/", requireAuth, uploadListing.array("images", 5), createListing);
router.get("/store/:StoreId", getAllListingStore);
router.get("/", getAllListing);
router.get("/search", searchListings);
router.get("/vip", requireAuth, promotionController.listSellerPromotions);
router.post("/vip/bulk", requireAuth, promotionController.promoteListings);
router.get("/:ListingId", getListingId);
router.patch("/:ListingId", requireAuth, updateListing);
router.patch("/:ListingId/hidden", requireAuth, hiddenListing);
router.get("/:ListingId/vip", requireAuth, promotionController.getVipStatus);
router.post("/:ListingId/vip", requireAuth, promotionController.promoteListing);
router.patch("/:ListingId/vip/stop", requireAuth, promotionController.stopPromotion);

module.exports = router;