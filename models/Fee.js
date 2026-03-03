const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Fee = sequelize.define('Fee', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    planId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM('pending', 'paid', 'overdue', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
    },
    dueDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
    },
    paidDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
    },
    invoicePath: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    proofPath: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    notes: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    planChangeRequestId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
});

module.exports = Fee;
