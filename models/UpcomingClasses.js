const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const UpcomingClass = sequelize.define('UpcomingClass', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    date: {
        type: Sequelize.DATEONLY,
        allowNull: false
    },
    time: {
        type: Sequelize.TIME,
        allowNull: false
    },
    meetingLink: {
        type: Sequelize.STRING,
        allowNull: false
    },
    
});

module.exports = UpcomingClass;

