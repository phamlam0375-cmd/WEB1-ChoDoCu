const express = require('express');

const {
    getStore,
    getAllStore,
    updateStore,
} = require('../controllers/store.controller');
const router = express.Router();
const { requireTokenAuth } = require('../middlewares/auth.middleware');


router.get("/", getAllStore);
router.get("/:ownerId", getStore);
router.patch("/:ownerId", requireTokenAuth, updateStore);

module.exports = router;
