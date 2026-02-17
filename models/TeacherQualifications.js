const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const TeacherQualification = sequelize.define('TeacherQualification', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    degree: {
        type: Sequelize.STRING,
        allowNull: false
    },
    institution: {
        type: Sequelize.STRING,
        allowNull: false
    },
    year: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    teacherId: {
        type: Sequelize.INTEGER,
        allowNull: false
    }
});

module.exports = TeacherQualification;