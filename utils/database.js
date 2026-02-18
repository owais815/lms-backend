const Sequelize = require('sequelize');

// Use environment-based configuration
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, {
    dialect: config.dialect,
    host: config.host,
    logging: false
});

module.exports = sequelize;