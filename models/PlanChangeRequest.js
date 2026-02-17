const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const PlanChangeRequest = sequelize.define('PlanChangeRequest', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'Students',
            key: 'id',
        },
    },
    currentPlanId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'Plans',
            key: 'id',
        },
    },
    requestedPlanId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'Plans',
            key: 'id',
        },
    },
    status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
    },
    paymentStatus: {
        type: Sequelize.ENUM('pending', 'paid'),
        defaultValue: 'pending',
    },
});

module.exports = PlanChangeRequest;
