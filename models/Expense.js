const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Expense = sequelize.define('Expense', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    categoryId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'ExpenseCategories', key: 'id' },
        onDelete: 'SET NULL',
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
    },
    purchasedBy: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    paymentMethod: {
        type: Sequelize.ENUM('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Cheque', 'Other'),
        allowNull: true,
        defaultValue: 'Cash',
    },
    status: {
        type: Sequelize.ENUM('New', 'Pending', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'New',
    },
    notes: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    createdById: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Admins', key: 'id' },
        onDelete: 'SET NULL',
    },
});

module.exports = Expense;
