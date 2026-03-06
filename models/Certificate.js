const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Certificate = sequelize.define('Certificate', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    courseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    templateImageUrl: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    issuedAt: {
        type: Sequelize.DATEONLY,
        allowNull: true,
    },
    status: {
        type: Sequelize.ENUM('upcoming', 'issued', 'revoked'),
        allowNull: false,
        defaultValue: 'issued',
    },
    notes: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
});

module.exports = Certificate;
