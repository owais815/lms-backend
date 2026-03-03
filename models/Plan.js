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
        type: Sequelize.JSON,
        allowNull: true,
    },
    billingCycle: {
        type: Sequelize.ENUM('monthly', 'quarterly', 'yearly', 'one-time'),
        allowNull: false,
        defaultValue: 'monthly',
    },
    durationDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Number of days the plan is valid',
    },
});

module.exports = Plan;
