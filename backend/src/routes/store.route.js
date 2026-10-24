const express = require('express');

const {
    getStore,
    getAllStore,
    updateStore,
} = require('../controllers/store.controller');
const router = express.Router();


router.get("/", getAllStore);
router.get("/:ownerId", getStore);
router.patch("/:ownerId", updateStore);

module.exports = router;