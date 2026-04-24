const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const ExpenseCategory = sequelize.define('ExpenseCategory', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM('Active', 'Inactive'),
        allowNull: false,
        defaultValue: 'Active',
    },
});

module.exports = ExpenseCategory;
