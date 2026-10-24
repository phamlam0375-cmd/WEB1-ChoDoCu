const express = require("express");

const {
  createPartnerApplication,
  getAllPatnerApplication,
  getPatnerApplicationId,
  sendPartnerOtp,
  verifyPartnerOtp
} = require("../controllers/partnerApplications.controller.js");
const uploadPartner = require("../../middleware/upload/partnerApplicationUpload.js");
const { requireTokenAuth } = require('../middlewares/auth.middleware');

const router = express.Router();


//Pattern applications
router.post("/", requireTokenAuth, uploadPartner.single("IdentityImageUrl"), createPartnerApplication);
router.get("/", getAllPatnerApplication);
router.get("/:id", getPatnerApplicationId);
router.post("/send-otp", sendPartnerOtp);
router.post("/verify-otp", verifyPartnerOtp);

module.exports = router;
