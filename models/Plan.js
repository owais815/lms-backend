const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Plan = sequelize.define('Plan', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    description: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    features: {
        type: Sequelize.JSON, // Store as a JSON string
        allowNull: true,
    },
});

module.exports = Plan;
