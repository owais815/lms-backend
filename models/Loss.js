const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Loss = sequelize.define('Loss', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
    },
    reason: {
        type: Sequelize.STRING,
        allowNull: true,
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

module.exports = Loss;
