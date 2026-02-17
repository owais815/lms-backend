// models/WeeklyContent.js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../utils/database');
const CourseDetails = require('./CourseDetails');

const WeeklyContent = sequelize.define('WeeklyContent', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    courseDetailId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: CourseDetails,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    weekNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    heading: {
        type: DataTypes.STRING, // Optional custom heading
        allowNull: true
    },
});

CourseDetails.hasMany(WeeklyContent, { foreignKey: 'courseDetailId' });
WeeklyContent.belongsTo(CourseDetails, { foreignKey: 'courseDetailId' });

module.exports = WeeklyContent;
