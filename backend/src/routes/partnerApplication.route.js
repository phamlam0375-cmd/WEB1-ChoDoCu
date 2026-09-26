const express = require("express");

const {
  createPartnerApplication,
  getAllPatnerApplication,
  getPatnerApplicationId,
} = require("../controllers/partnerApplications.controller.js");

const router = express.Router();


//Pattern applications
router.post("/", createPartnerApplication);
router.get("/", getAllPatnerApplication);
router.get("/:id", getPatnerApplicationId);

module.exports = router;