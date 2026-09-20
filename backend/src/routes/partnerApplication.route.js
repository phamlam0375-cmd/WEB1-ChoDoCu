const express = require("express");

const {
  createPartnerApplication,
} = require("../controllers/partnerApplications.controller.js");

const router = express.Router();

router.post("/", createPartnerApplication);

module.exports = router;