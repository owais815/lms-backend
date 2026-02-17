const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Specialization = sequelize.define('Specialization', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true
    }
});

module.exports = Specialization;