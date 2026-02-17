const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Courses = sequelize.define('Course', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    courseName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    duration: {
        type: Sequelize.STRING,
        allowNull: true
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    price: {
        type: Sequelize.FLOAT,
        allowNull: true
    },
    isComing:{
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    imageUrl: {
        type: Sequelize.STRING,
        allowNull: true
    }

});

module.exports = Courses;
