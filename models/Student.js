const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Student = sequelize.define('Student', {
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
        allowNull: true
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
        allowNull: true
    },
    address: {
        type: Sequelize.STRING,
        allowNull: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true
    },
    status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: true,
        defaultValue: 'active'
    },
    dateOfBirth: {
        type: Sequelize.DATE,
        allowNull: true
    },
    guardian: {
        type: Sequelize.STRING,
        allowNull: true
    },
    emergencyContact: {
        type: Sequelize.STRING,
        allowNull: true
    },
    //newly added field
    profileImg: {
        type: Sequelize.STRING, 
        allowNull: true
    },
    planId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'Plans',
            key: 'id',
        },
    },
    countryName: {
        type: Sequelize.STRING,
        allowNull: true
    },
    state: {
        type: Sequelize.STRING,
        allowNull: true
    },
    city: {
        type: Sequelize.STRING,
        allowNull: true
    },
    timeZone: {
        type: Sequelize.STRING,
        allowNull: true
    },
    flexibleHours: {
        type: Sequelize.TIME,
        allowNull: true
    },
    suitableHours: {
        type: Sequelize.TIME,
        allowNull: true
    },

    nameForTeacher: {
        type: Sequelize.STRING,
        allowNull: true
    },
    shift: {
        type: Sequelize.ENUM('Morning', 'Afternoon', 'Evening'),
        allowNull: true,
        defaultValue: null
    },
    studentLabel: {
        type: Sequelize.ENUM('Unassigned', 'Trial', 'New Enrollment', 'Lost', 'Struck off'),
        allowNull: true,
        defaultValue: null
    },
    struckOffReason: {
        type: Sequelize.STRING,
        allowNull: true
    },
    enrollmentChannel: {
        type: Sequelize.ENUM('Meta', 'Google', 'TikTok', 'SEO', 'Email', 'Reference'),
        allowNull: true,
        defaultValue: null
    },
    referenceDetails: {
        type: Sequelize.STRING,
        allowNull: true
    },
    // FK to Parent — one parent can have many students
    parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'Parents',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
});

module.exports = Student;
