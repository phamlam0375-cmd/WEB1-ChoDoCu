const { Sequelize } = require('sequelize');
const environments = require('../config/config');

const environment = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(environments[environment]);

module.exports = sequelize;
