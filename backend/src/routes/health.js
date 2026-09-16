const express = require('express');
const sequelize = require('../database');

const router = express.Router();

router.get('/', async (_request, response) => {
  try {
    await sequelize.authenticate();
    response.json({
      status: 'ok',
      service: 'cho-do-cu-api',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    response.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: error.message
    });
  }
});

module.exports = router;
