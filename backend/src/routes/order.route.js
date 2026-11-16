'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { requireTokenAuth } = require('../middlewares/auth.middleware');

// Both compatibility prefixes require a real JWT.
function createOrderRouter() {
  const router = express.Router();
  const d01Auth = requireTokenAuth;
  router.get('/preview/:listingId', d01Auth, orderController.getOrderPreview);
  router.post('/', d01Auth, orderController.createOrder);
  return router;
}

module.exports = createOrderRouter();
module.exports.createOrderRouter = createOrderRouter;
