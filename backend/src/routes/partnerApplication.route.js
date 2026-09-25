const express = require("express");

const {
  createPartnerApplication,
  getPatnerApplication,
} = require("../controllers/partnerApplications.controller.js");

const router = express.Router();


//Pattern applications
router.post("/", createPartnerApplication);
router.get("/", getPatnerApplication);

module.exports = router;