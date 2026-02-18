const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Role = require('./Roles');

const AdminRights = sequelize.define('AdminRight', {
    AdminId: {
        type: Sequelize.INTEGER,
        required: true,
        primaryKey: true
    },
    RightId: {
        type: Sequelize.INTEGER,
        required: true,
        primaryKey: true
    }
}, {
    timestamps: false // Disable timestamps for junction table
});

module.exports = AdminRights;
