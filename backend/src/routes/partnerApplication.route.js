const express = require("express");

const {
  createPartnerApplication,
  getAllPatnerApplication,
  getPatnerApplicationId,
  sendPartnerOtp,
  verifyPartnerOtp
} = require("../controllers/partnerApplications.controller.js");
const uploadPartner = require("../middlewares/upload/partnerApplicationUpload.js");
const { requireRole, requireTokenAuth } = require('../middlewares/auth.middleware');

const router = express.Router();


//Pattern applications
router.post("/", requireTokenAuth, uploadPartner.single("IdentityImageUrl"), createPartnerApplication);
router.get("/", requireTokenAuth, requireRole("ADMIN"), getAllPatnerApplication);
router.get("/:id", requireTokenAuth, requireRole("ADMIN"), getPatnerApplicationId);
router.post("/send-otp", sendPartnerOtp);
router.post("/verify-otp", verifyPartnerOtp);

module.exports = router;
