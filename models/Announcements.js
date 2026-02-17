const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const Announcements = sequelize.define('Announcements', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    scheduledTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    expirationDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    userType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('payment','class','general','assessment'),
        allowNull: false,
        defaultValue:'general'
    }
});

module.exports = Announcements