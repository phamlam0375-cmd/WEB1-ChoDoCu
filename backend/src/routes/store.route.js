const express = require('express');

const {
    getStore,
    getAllStore,
    updateStore,
} = require('../controllers/store.controller');
const uploads = require('../controllers/uploads.controller');
const router = express.Router();
const { requireTokenAuth } = require('../middlewares/auth.middleware');


router.get("/", getAllStore);
router.get("/:ownerId", getStore);
router.patch("/:ownerId", requireTokenAuth, updateStore);
router.post(
    "/:ownerId/qr",
    requireTokenAuth,
    express.raw({ type: ["image/jpeg", "image/png", "application/octet-stream"], limit: uploads.MAX_BYTES }),
    uploads.uploadStoreQrImage
);

module.exports = router;
