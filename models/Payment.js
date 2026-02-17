const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Payment = sequelize.define('Payment', {
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
    amount: {
        type: Sequelize.FLOAT,
        allowNull: false,
    },
    purpose: {
        type: Sequelize.STRING, // e.g., 'Plan Purchase', 'Plan Upgrade', etc.
        allowNull: false,
    },
    paymentDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
});

module.exports = Payment;
