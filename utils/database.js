const Sequelize = require('sequelize');

// Use environment-based configuration
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, {
    dialect: config.dialect,
    host: config.host,
    logging: false,
    // Sequelize defaults to max 5, which was fine while the API was the only
    // process. The email worker is a second process sharing this database, so
    // set it explicitly per process: DB_POOL_MAX=15 for the API, 6 for the
    // worker. Two processes then peak at ~21 connections against MySQL's
    // default max_connections of 151.
    pool: {
        max: Number(process.env.DB_POOL_MAX || 10),
        min: 0,
        acquire: 30000,
        idle: 10000,
        evict: 10000,
    },
});

module.exports = sequelize;
