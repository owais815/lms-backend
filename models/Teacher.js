const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const CourseDetails = require('./CourseDetails');
const TeacherQualification = require('./TeacherQualifications');
const Specialization = require('./TeacherSpecialization');

const Teacher = sequelize.define('Teacher', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    firstName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    contact: {
        type: Sequelize.STRING,
        allowNull: false
    },
    cnic: {
        type: Sequelize.STRING,
        allowNull: false
    },
    imageUrl: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

Teacher.hasMany(CourseDetails, { foreignKey: 'teacherId' });
Teacher.hasMany(TeacherQualification, { foreignKey: 'teacherId' });
Teacher.hasMany(Specialization, { foreignKey: 'teacherId' });

module.exports = Teacher;
