const express = require('express');

const { getStore, getAllStore } = require('../controllers/store.controller');
const router = express.Router();


router.get("/", getAllStore);
router.get("/:ownerId", getStore);

module.exports = router;